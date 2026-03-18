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
8. Store refresh token in Redis: `SET refresh:<user.id>:<jti> 1 EX 604800` (per-session key — supports multiple concurrent devices)
9. Set httpOnly cookie `refresh_token`; return access token in body

### Refresh
1. Read `refresh_token` cookie
2. `jwt.verify(token, REFRESH_SECRET)`
3. Validate `jti` against Redis `refresh:<user.id>:<jti>` — return `401` if not found
4. Issue new access token; rotate refresh token (delete old, store new)

### Logout
1. Use `jti` and `exp` from the already-verified `req.user` payload (do **not** re-decode the raw token)
2. Compute remaining TTL: `exp - Math.floor(Date.now() / 1000)`; if `> 0` → `SET blocklist:<jti> 1 EX <ttl>`
3. Delete all `refresh:<user.id>:*` keys from Redis via non-blocking `SCAN` (supports multiple concurrent sessions)
4. Clear `refresh_token` httpOnly cookie

---

## Task Service Authorization

Authorization is enforced at the **service layer**, in addition to route-level `requireRole` guards:

| Operation | Route guard | Service check |
|-----------|-------------|---------------|
| `GET /tasks`, `GET /tasks/:id` | `authGuard` only | None |
| `POST /tasks` | `authGuard` only | Project must not be `archived` (returns `400` if archived) |
| `PUT /tasks/:id`, `PATCH /tasks/:id` | `authGuard` only | `member` may only update tasks where `reporter_id === req.user.sub`; manager/admin unrestricted |
| `DELETE /tasks/:id` | `requireRole('manager')` | Sequelize soft-delete |

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

- Runs every hour (`0 * * * *`)
- Queries tasks where `due_date BETWEEN now AND now+24h`, `status != 'done'`, `is_deleted = false`, `assignee_id IS NOT NULL`
- Uses a Redis dedup key `notified_due_soon:<task_id>` (TTL 25 h, set with `NX`) to prevent duplicate notifications across consecutive hourly runs
- Notifications are sent in **parallel** via `Promise.all` — not serially

---

## Socket.io Server (socket-server.ts)

Authentication middleware (mirrors `authGuard`):

1. Require `socket.handshake.auth.token`; reject with `'Authentication required'` if absent
2. `jwt.verify(token, JWT_SECRET)` — reject with `'Invalid token'` if invalid/expired
3. Check Redis `blocklist:<jti>` — reject with `'Token has been invalidated'` if found
4. If the Redis check **throws** (Redis unavailable) — reject with `'Internal server error'` (**fail closed**)
5. On success: attach payload to `socket.user`; join room `user:<sub>`

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
- Task authorization (member ownership check, manager-only delete) must have integration test coverage

**Coverage targets:** 80% lines across services and middleware.

---

## Health Check

`GET /health` — no auth required; **not** logged by Morgan.

Probes both PostgreSQL (`sequelize.authenticate()`) and Redis (`redisClient.ping()`).

| Result | HTTP status | Body |
|--------|-------------|------|
| Both healthy | `200 OK` | `{ "status": "ok", "timestamp": "<ISO 8601>" }` |
| Either unhealthy | `503 Service Unavailable` | `{ "status": "error", "timestamp": "<ISO 8601>" }` |

ALB uses this endpoint for instance health checks (interval 30 s, threshold 2 failures). A `503` removes the instance from the target group.
