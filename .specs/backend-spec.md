# Back-End Specification

## Stack

| Concern | Library | Version |
|---------|---------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Express | 4.18 |
| ORM | Sequelize | 6.x |
| Database | PostgreSQL | 16 |
| Cache | Redis (ioredis) | 7 |
| Auth tokens | jsonwebtoken | 9.x |
| Password hashing | bcrypt | — |
| Input validation | Joi | — |
| Security headers | Helmet | — |
| Rate limiting | express-rate-limit + rate-limit-redis | — |
| Real-time | Socket.io | — |
| Logging | Winston + Morgan | — |
| Email | Nodemailer (AWS SES transport) | — |
| Scheduler | node-cron | — |
| Testing | Jest + Supertest | — |

---

## Project Structure

```
server/src/
├── app.ts                        # Express app factory (no listen here)
├── server.ts                     # HTTP + Socket.io server, listen on port 3000
├── middleware/
│   ├── auth-guard.ts             # JWT verify; attaches req.user
│   ├── require-role.ts           # RBAC factory: requireRole('admin')
│   ├── helmet-config.ts
│   ├── cors-config.ts
│   ├── rate-limit.ts             # global 100/min + auth 10/min
│   └── validate.ts               # Joi schema middleware factory
├── services/
│   ├── auth/
│   │   ├── auth-router.ts
│   │   ├── auth-controller.ts
│   │   ├── auth-service.ts       # business logic
│   │   └── auth-schemas.ts       # Joi schemas
│   ├── tasks/
│   │   ├── task-router.ts
│   │   ├── task-controller.ts
│   │   ├── task-service.ts
│   │   └── task-schemas.ts
│   ├── users/
│   │   ├── user-router.ts
│   │   ├── user-controller.ts
│   │   ├── user-service.ts
│   │   └── user-schemas.ts
│   ├── projects/
│   │   ├── project-router.ts
│   │   ├── project-controller.ts
│   │   ├── project-service.ts
│   │   └── project-schemas.ts
│   └── notifications/
│       ├── notification-router.ts
│       ├── notification-controller.ts
│       ├── notification-service.ts  # create, emit, email
│       └── due-soon-job.ts          # node-cron scheduler
├── socket/
│   └── socket-server.ts          # Socket.io setup, auth middleware, room join
├── models/                       # Sequelize model definitions
│   ├── index.ts                  # sequelize instance + model associations
│   ├── user.model.ts
│   ├── project.model.ts
│   ├── task.model.ts
│   ├── comment.model.ts
│   └── notification.model.ts
├── config/
│   ├── database.ts               # Sequelize config per environment
│   ├── redis.ts                  # ioredis client singleton
│   └── env.ts                    # typed env var loader (throws on missing)
└── logger/
    ├── logger.ts                 # Winston instance
    └── morgan-stream.ts          # Morgan → Winston stream
```

All files use **kebab-case**.

---

## App Bootstrap (app.ts)

```ts
// Middleware order matters:
app.use(helmet(...))
app.use(cors(corsConfig))
app.use(express.json({ limit: '100kb' }))
app.use(morgan('combined', { stream: morganStream }))
app.use('/v1/auth', authRateLimiter, authRouter)
app.use('/v1/tasks', globalRateLimiter, authGuard, taskRouter)
app.use('/v1/users', globalRateLimiter, authGuard, userRouter)
app.use('/v1/projects', globalRateLimiter, authGuard, projectRouter)
app.use('/v1/notifications', globalRateLimiter, authGuard, notificationRouter)
app.use(errorHandler)  // must be last
```

---

## Middleware Details

### auth-guard.ts

1. Extract token from `Authorization: Bearer <token>`
2. `jwt.verify(token, JWT_SECRET)` — throw `401` if invalid or expired
3. Check Redis blocklist key `blocklist:<jti>` — throw `401` if found
4. Attach decoded payload to `req.user`

### require-role.ts

```ts
export const requireRole = (...roles: Role[]) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json(...)
    next()
  }
```

### validate.ts

```ts
export const validate = (schema: Joi.Schema, target: 'body' | 'query' | 'params') =>
  (req, res, next) => {
    const { error } = schema.validate(req[target], { abortEarly: false })
    if (error) return res.status(400).json(toRFC7807(error))
    next()
  }
```

### rate-limit.ts

```ts
// Global: 100 req/min per IP
export const globalRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  store: new RedisStore({ client: redisClient }),
})

// Auth endpoints: 10 req/min per IP
export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  store: new RedisStore({ client: redisClient }),
})
```

---

## Auth Service Logic

### Login
1. Find user by email; return `401` if not found or `is_active = false`
2. Check `locked_until` — return `423` if in future
3. `bcrypt.compare(password, user.password_hash)`
4. On failure: increment `failed_login_attempts`; if ≥ 5, set `locked_until = NOW() + 30 min`; return `401`
5. On success: reset `failed_login_attempts = 0`
6. Issue access token: `jwt.sign({ sub: user.id, role: user.role, jti: uuid() }, JWT_SECRET, { expiresIn: '15m' })`
7. Issue refresh token: `jwt.sign({ sub: user.id, jti: uuid() }, REFRESH_SECRET, { expiresIn: '7d' })`
8. Store refresh token in Redis: `SET refresh:<user.id> <jti> EX 604800`
9. Set httpOnly cookie `refresh_token`; return access token in body

### Refresh
1. Read `refresh_token` cookie
2. `jwt.verify(token, REFRESH_SECRET)`
3. Validate `jti` against Redis `refresh:<user.id>` — return `401` if mismatch
4. Issue new access token; rotate refresh token (delete old, store new)

### Logout
1. Get `jti` from access token → store in Redis blocklist: `SET blocklist:<jti> 1 EX <remaining_ttl>`
2. Delete `refresh:<user.id>` from Redis
3. Clear `refresh_token` cookie

---

## Notification Service

### Trigger points (called async — do not await in request path)

| Event | Notification type | Recipients |
|-------|-------------------|-----------|
| Task assigned | `task_assigned` | assignee |
| Task status changed | `task_updated` | assignee, reporter |
| Comment added | `task_commented` | assignee + reporter (excluding author) |
| Due date within 24h | `task_due_soon` | assignee |

### Notification creation flow

```ts
async function notify(type, referenceId, referenceType, recipientIds, message) {
  // 1. Insert rows into notifications table
  // 2. For each recipient: io.to(`user:${recipientId}`).emit('notification:new', row)
  // 3. Send email via Nodemailer (AWS SES) — non-blocking
}
```

### Due-soon job (node-cron)

```ts
// Runs every hour
cron.schedule('0 * * * *', async () => {
  const tasks = await Task.findAll({
    where: {
      due_date: { [Op.between]: [now, now + 24h] },
      status: { [Op.ne]: 'done' },
      is_deleted: false,
    }
  })
  for (const task of tasks) {
    await notify('task_due_soon', task.id, 'task', [task.assignee_id], `Task "${task.title}" is due soon.`)
  }
})
```

---

## Socket.io Server (socket-server.ts)

```ts
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    socket.data.user = payload
    next()
  } catch {
    next(new Error('Unauthorized'))
  }
})

io.on('connection', (socket) => {
  socket.join(`user:${socket.data.user.sub}`)
})
```

---

## Error Handler

Global Express error handler (last middleware):

```ts
app.use((err, req, res, next) => {
  logger.error(err)
  const status = err.status || 500
  res.status(status).json({
    type: `https://api.tma.internal/errors/${slugify(err.name)}`,
    title: err.name,
    status,
    detail: status < 500 ? err.message : 'Internal server error',
  })
})
```

Never expose stack traces or internal error messages in production (`NODE_ENV === 'production'`).

---

## Environment Variables (server)

```
NODE_ENV=development|staging|production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/tma
REDIS_URL=redis://host:6379
JWT_SECRET=<from AWS Secrets Manager>
REFRESH_SECRET=<from AWS Secrets Manager>
JWT_EXPIRES_IN=15m
REFRESH_EXPIRES_IN=7d
CORS_ORIGINS=https://tma.internal
SES_REGION=ap-southeast-1
SES_FROM=noreply@tma.internal
```

Loaded via `config/env.ts` which throws on startup if required vars are missing.

---

## Testing (Jest + Supertest)

```bash
# from server/
npm test                          # all tests
npm test -- --testPathPattern auth  # single suite
npm run test:coverage             # coverage report
```

**Test strategy:**
- Unit tests for services (mock Sequelize models and Redis)
- Integration tests for route handlers via Supertest (real DB in Docker Compose test profile)
- Auth flow (login, refresh, logout, lockout) must have integration test coverage
- Joi schema validation tested via unit tests

**Coverage targets:** 80% lines across services and middleware.
