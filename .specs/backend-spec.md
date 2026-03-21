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
| Concurrency | p-limit | — |
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
│   ├── mailer.ts                 # Nodemailer transport singleton (Mailpit in dev, SES in prod)
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
    const { error, value } = schema.validate(req[target], { abortEarly: false, stripUnknown: true })
    if (error) return res.status(400).json(toRFC7807(error))
    req[target] = value  // replace with stripped/coerced value
    next()
  }
```

`stripUnknown: true` removes unrecognised fields from the validated input before it reaches the service layer, preventing unexpected data from being passed to Sequelize.

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

### Forgot Password
1. Look up user by email. **Always return `200 OK`** — never reveal whether the address exists.
2. If user found and `is_active = true`: generate a reset token with `crypto.randomBytes(32).toString('hex')` — never use a JWT for this.
3. Store in Redis: `SET pwd_reset:<token> <user.id> EX 3600` (1-hour TTL, single-use)
4. Send email containing `APP_URL/reset-password?token=<token>` via Nodemailer.

### Reset Password
1. Read `token` from request body; look up `pwd_reset:<token>` in Redis — return `400` if not found (expired or already used).
2. Validate `new_password` via Joi (min 8 chars, 1 uppercase, 1 digit).
3. Hash with `bcrypt.hash(new_password, 12)`.
4. Update `users.password_hash`. Delete the Redis key immediately (single-use enforced).
5. Invalidate all existing refresh tokens for the user: delete all `refresh:<user.id>:*` keys via SCAN.
6. Return `200 OK`.

### Change Password
1. Caller must be authenticated (`authGuard` applied).
2. Load user with `password_hash` scope; return `400` if `current_password` does not match (`bcrypt.compare`).
3. Hash `new_password` with `bcrypt.hash(newPassword, 12)`.
4. Update `users.password_hash`. Return `200 OK`.

---

## Task Service Authorization

Authorization is enforced at the **service layer**, in addition to route-level `requireRole` guards:

| Operation | Route guard | Service check |
|-----------|-------------|---------------|
| `GET /tasks` | `authGuard` only | `member` sees only tasks where `assignee_id === req.user.sub` OR `reporter_id === req.user.sub`; manager/admin see all tasks in the system |
| `GET /tasks/:id` | `authGuard` only | Fetch task; then verify caller is `admin`, `manager`, the `assignee_id`, or the `reporter_id` — return `403` otherwise |
| `POST /tasks` | `authGuard` only | Project must not be `archived` (returns `400` if archived) |
| `PUT /tasks/:id`, `PATCH /tasks/:id` | `authGuard` only | `member` may only update tasks where `reporter_id === req.user.sub`; manager/admin unrestricted |
| `DELETE /tasks/:id` | `requireRole('manager')` | Sequelize soft-delete |
| `DELETE /tasks/:taskId/comments/:commentId` | `authGuard` only | `author_id === req.user.sub` OR `req.user.role === 'admin'` — return `403` otherwise; set `is_deleted = true` |

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

**Concurrency cap:** All ad-hoc calls to `notify()` that fan out to multiple recipients must also use `p-limit(10)` to cap concurrent SES sends and Redis writes. This applies to the comment notification flow (up to 2 recipients) and any future bulk triggers.

### Due-soon job (node-cron)

- Runs every hour (`0 * * * *`)
- Queries tasks where `due_date BETWEEN now AND now+24h`, `status != 'done'`, `is_deleted = false`, `assignee_id IS NOT NULL`
- Uses a Redis dedup key `notified_due_soon:<task_id>` (TTL 25 h, set with `NX`) to prevent duplicate notifications across consecutive hourly runs
- **Distributed lock:** Before executing, acquire `SET due_soon_lock 1 EX 55 NX`. If the lock is not acquired (another instance already running), skip this run silently. This prevents double-execution when multiple EC2 instances run the same cron simultaneously.
- Notifications are sent with **bounded concurrency** via `p-limit` (max 10 concurrent) — not unbounded `Promise.all`

```ts
import pLimit from 'p-limit'
const limit = pLimit(10)
await Promise.all(tasks.map(task => limit(() => notify(...))))
```

---

## Socket.io Server (socket-server.ts)

Authentication middleware (mirrors `authGuard`):

1. Require `socket.handshake.auth.token`; reject with `'Authentication required'` if absent
2. `jwt.verify(token, JWT_SECRET)` — reject with `'Invalid token'` if invalid/expired
3. Check Redis `blocklist:<jti>` — reject with `'Token has been invalidated'` if found
4. If the Redis check **throws** (Redis unavailable) — reject with `'Internal server error'` (**fail closed**)
5. On success: attach payload to `socket.user`; join room `user:<sub>`

**Token expiry on long-lived connections:** After initial handshake, the server must enforce token expiry on long-lived sockets. Register a server-side timer on each connection:
```ts
const msUntilExpiry = (socket.user.exp * 1000) - Date.now()
setTimeout(() => socket.disconnect(true), msUntilExpiry)
```
Clients must reconnect with a fresh access token (obtained via `POST /auth/refresh`) after their current token expires. The client's `use-socket.ts` must listen for `disconnect` events caused by expiry and reconnect with a refreshed token.

---

## Error Handler

Global Express error handler (last middleware):

```ts
// Allowlist of safe, user-facing error names to expose in the response.
// Sequelize, jsonwebtoken, and other internal class names must never appear.
const SAFE_ERROR_NAMES = new Set([
  'ValidationError',
  'NotFoundError',
  'UnauthorizedError',
  'ForbiddenError',
  'ConflictError',
  'LockedError',
  'RateLimitError',
])

app.use((err, req, res, next) => {
  logger.error(err)
  const status = err.status || 500
  const safeName = SAFE_ERROR_NAMES.has(err.name) ? err.name : 'InternalServerError'
  res.status(status).json({
    type: `https://api.tma.internal/errors/${slugify(safeName)}`,
    title: safeName,
    status,
    detail: status < 500 ? err.message : 'Internal server error',
  })
})
```

Never expose stack traces or internal error messages in production (`NODE_ENV === 'production'`). Always use the `SAFE_ERROR_NAMES` allowlist — never pass `err.name` directly to the response.

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
APP_URL=https://tma.internal              # base URL for password reset links
SES_REGION=ap-southeast-1
SES_FROM=noreply@tma.internal
SES_SMTP_USER=<from AWS Secrets Manager>  # production only
SES_SMTP_PASS=<from AWS Secrets Manager>  # production only
```

In **development**, `mailer.ts` detects the absence of SES credentials and routes all email to **Mailpit** on `localhost:1025` (port mapped from the `mailhog` Docker service). No SES credentials are needed locally.

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
- Unit tests for services — Sequelize models and Redis are **mocked** (no real DB or Redis required)
- Integration tests for route handlers via **Supertest** — service layer is mocked; tests exercise Express middleware chain (validation, auth guard, role check) end-to-end without a database
- Auth flow (login, refresh, logout, lockout) covered by route integration tests
- Joi schema validation covered by dedicated schema unit tests

**Test files (130 tests total):**

| File | Tests | What it covers |
|------|-------|----------------|
| `src/services/auth/auth-schemas.test.ts` | 32 | Joi validation: register, login, reset-password, change-password |
| `src/middleware/auth-guard.test.ts` | 8 | Missing header, bad scheme, expired JWT, Redis blocklist hit |
| `src/middleware/require-role.test.ts` | 9 | RBAC hierarchy: admin ≥ manager ≥ member; 403 on insufficient role |
| `src/services/auth/auth-service.test.ts` | 30 | Register, login, lockout, refresh, logout, forgotPassword, resetPassword |
| `src/services/tasks/task-service.test.ts` | 26 | Member ownership scoping, assignee/reporter access, archived-project guard |
| `src/services/auth/auth-routes.test.ts` | 25 | Supertest across all 7 auth endpoints (register, login, refresh, logout, forgot, reset, change-password) |

**Coverage targets:** 80% lines across services and middleware.

---

## Query Requirements

### Eager Loading (N+1 prevention)

All task queries that return associated objects (`project`, `assignee`, `reporter`, `comments`) **must** use Sequelize `include` to eager-load associations in a single query. Never fetch associations in a loop.

```ts
// Correct — single query with JOIN
Task.findAll({
  include: [
    { model: Project, attributes: ['id', 'name'] },
    { model: User, as: 'assignee', attributes: ['id', 'full_name'] },
    { model: User, as: 'reporter', attributes: ['id', 'full_name'] },
  ],
  where: { is_deleted: false, ...filters },
})

// Forbidden — N+1
const tasks = await Task.findAll(...)
for (const task of tasks) {
  task.project = await Project.findByPk(task.project_id) // ← N+1
}
```

Always use `attributes` projection to exclude unused columns (especially `password_hash`).

### Joi Input Constraints for Tasks

The `task-schemas.ts` Joi schema must enforce:

| Field | Rule |
|-------|------|
| `title` | `Joi.string().max(200).required()` |
| `description` | `Joi.string().max(10000).optional().allow('')` |
| `priority` | `Joi.string().valid('low','medium','high','critical').default('medium')` |
| `due_date` | `Joi.date().iso().min('now').optional()` |

The `description` max of 10 000 characters is mandatory. Without it, a request with a large payload will collide with the 100 KB `express.json` body limit and return a confusing `413` instead of a `400` with a validation message.

---

## Health Check

`GET /health` — no auth required; **not** logged by Morgan.

Probes both PostgreSQL (`sequelize.authenticate()`) and Redis (`redisClient.ping()`).

| Result | HTTP status | Body |
|--------|-------------|------|
| Both healthy | `200 OK` | `{ "status": "ok", "timestamp": "<ISO 8601>" }` |
| Either unhealthy | `503 Service Unavailable` | `{ "status": "error", "timestamp": "<ISO 8601>" }` |

ALB uses this endpoint for instance health checks (interval 30 s, threshold 2 failures). A `503` removes the instance from the target group.
