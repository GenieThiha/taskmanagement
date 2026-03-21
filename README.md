# TMA-2026 — Task Management Application

An internal team task manager for up to 50 users. Built with a three-tier architecture following the Waterfall SDLC.

**Go-live target:** Q3 2026 · **Region:** AWS ap-southeast-1

---

## Architecture

```
Browser (React SPA)
      │  HTTPS
      ▼
  CloudFront / S3
      │  REST/JSON
      ▼
Express API  (:3000)
  ├── Auth service      JWT · bcrypt · account lockout
  ├── Task service      CRUD · Kanban · comments
  ├── User service      roles · profiles
  ├── Project service   lifecycle management
  └── Notification svc  real-time (Socket.io) + email (SES)
      │                       │
      ▼                       ▼
PostgreSQL 16            Redis 7
(RDS db.t3.medium)   (ElastiCache)
                      JWT blocklist · refresh tokens
                      rate-limit counters · dedup keys
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3.4, Zustand 4, Recharts, dnd-kit |
| Backend | Node.js 20 LTS, Express 4.18, Sequelize 6, Joi, Helmet |
| Auth | jsonwebtoken 9, bcrypt (cost 12), httpOnly cookies |
| Cache | Redis 7 (ioredis) |
| Database | PostgreSQL 16 |
| Real-time | Socket.io 4 |
| Email | Nodemailer → AWS SES |
| Scheduler | node-cron |
| Infra | Docker 25, Docker Compose 2, GitHub Actions, AWS EC2 / RDS / ElastiCache / CloudFront / Route53 |

---

## Repository Layout

```
/
├── client/                  # React 18 SPA (Vite)
│   └── src/
│       ├── api/             # Axios instance — Bearer token + 401 refresh retry
│       ├── router/          # React Router v6, protected routes
│       ├── modules/
│       │   ├── auth/        # useAuth hook, Zustand store (token in memory only)
│       │   └── tasks/       # Zustand store, Kanban board (drag-and-drop)
│       ├── dashboard/       # KPI cards (Recharts) + activity feed
│       ├── notifications/   # Socket.io hook, notification bell
│       ├── projects/
│       ├── users/
│       └── shared/          # Button, Input, Modal, Avatar, Badge
├── server/
│   └── src/
│       ├── config/          # env, database, redis, mailer (singletons)
│       ├── middleware/       # Helmet, CORS, rate-limiter, authGuard, requireRole, validate
│       ├── models/          # Sequelize models — User, Project, Task, Comment, Notification
│       ├── services/
│       │   ├── auth/        # register · login · refresh · logout · forgot/reset password
│       │   ├── tasks/       # full CRUD + comments + optimistic Kanban patch
│       │   ├── users/       # list · get · update (RBAC-aware)
│       │   ├── projects/    # CRUD + archive
│       │   └── notifications/ # bulk insert · Socket.io emit · SES email · due-soon cron
│       ├── socket/          # Socket.io server — JWT + Redis blocklist auth
│       └── logger/          # Winston JSON + Morgan request logs
├── db/
│   ├── migrations/          # Sequelize CLI migrations
│   └── seeders/             # Development seed data
├── .github/
│   └── workflows/
│       ├── ci.yml           # Lint + test + audit on every feature branch / PR
│       └── deploy.yml       # Build → ECR → staging (auto) → production (manual gate)
├── docker-compose.yml       # Local dev: mailpit + postgres + redis + server + client
└── Task_Management_Web_Application_Architecture_&_Design.pdf    # Architecture & design reference
```

---

## Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 25+
- Docker Compose 2+

### Start all services

```bash
docker compose up --build
```

| Service | URL | Notes |
|---|---|---|
| React SPA | http://localhost:5173 | Vite HMR — changes to `client/src/` live-reload instantly |
| Express API | http://localhost:3000 | nodemon — changes to `server/src/` restart automatically |
| Mailpit (web UI) | http://localhost:8025 | Catches all outbound email in dev — open here to read them |
| PostgreSQL | localhost:5433 | Host port 5433 avoids clashing with a local PostgreSQL install |
| Redis | localhost:6379 | Standard port |

The server waits for Postgres and Redis health checks before starting.
The client waits for the server `/health` endpoint before starting.

### Local email (Mailpit)

In development all emails (password reset, notifications) are intercepted by **Mailpit** (`axllent/mailpit` image — ARM64 compatible) — nothing reaches a real mail server. To read a caught email open **http://localhost:8025** after triggering the action (e.g. forgot-password). No SES credentials are needed locally. The Docker service is named `mailhog` for legacy reasons but runs the Mailpit image.

### Run without Docker

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev          # nodemon on :3000

# Terminal 2 — frontend
cd client
npm install
npm run dev          # Vite on :5173
```

### Database migrations

```bash
# From server/
npx sequelize-cli db:migrate          # apply all pending
npx sequelize-cli db:migrate:undo     # rollback one
npx sequelize-cli db:seed:all         # load seed data
```

### Environment variables

Copy `.env.development` in each service and adjust as needed.
**Never commit secrets.** Production secrets are managed via AWS Secrets Manager.

| Variable | Service | Required | Description |
|---|---|---|---|
| `DATABASE_URL` | server | always | PostgreSQL connection string |
| `REDIS_URL` | server | always | Redis connection string |
| `JWT_SECRET` | server | always | Access token signing key |
| `REFRESH_SECRET` | server | always | Refresh token signing key |
| `APP_URL` | server | always | Base URL for password reset links |
| `CORS_ORIGINS` | server | always | Comma-separated allowed origins |
| `SES_SMTP_USER` | server | **production only** | AWS SES SMTP username — dev uses Mailpit |
| `SES_SMTP_PASS` | server | **production only** | AWS SES SMTP password — dev uses Mailpit |
| `VITE_API_BASE_URL` | client | **production only** | HTTPS API base URL (`/v1`) — build fails without it in prod |
| `VITE_SOCKET_URL` | client | **production only** | WSS Socket.io URL — build fails without it in prod |

> **Note:** `VITE_API_BASE_URL` and `VITE_SOCKET_URL` fall back to `http://localhost:*` for local dev only. A production Vite build (`NODE_ENV=production`) throws at startup if either is absent, preventing credentials from being sent over plain HTTP.

---

## Testing

**193 tests total** — 130 server (Jest) + 63 client (Vitest). Services and Sequelize models are mocked; no real DB or Redis required.

```bash
# Server (from server/)
npm test -- --run               # CI: run once and exit
npm test -- --testPathPattern auth  # single suite
npm run test:coverage

# Client (from client/)
npm test -- --run               # CI: run once and exit (watch mode exits 1 in CI)
npm run coverage
```

| Suite | File | Tests |
|---|---|---|
| Server | `services/auth/auth-schemas.test.ts` | 32 — Joi validation |
| Server | `middleware/auth-guard.test.ts` | 8 — JWT + blocklist |
| Server | `middleware/require-role.test.ts` | 9 — RBAC hierarchy |
| Server | `services/auth/auth-service.test.ts` | 30 — full auth lifecycle |
| Server | `services/tasks/task-service.test.ts` | 26 — member scoping, archived-project guard |
| Server | `services/auth/auth-routes.test.ts` | 25 — Supertest integration (all 7 auth routes) |
| Client | `modules/auth/auth-store.test.ts` | 13 — Zustand store |
| Client | `modules/auth/hooks/use-auth.test.ts` | 20 — session restore, login, logout |
| Client | `api/axios-instance.test.ts` | 14 — Bearer injection, refresh retry, concurrent 401 queue |
| Client | `router/protected-route.test.tsx` | 16 — RBAC route guard |

---

## API Reference

**Base URL:** `https://api.tma.internal/v1`
**Auth:** `Authorization: Bearer <access_token>` on all non-auth routes
**Content-Type:** `application/json`
**Error shape:** RFC 7807 Problem Details
**Pagination:** `?page=1&limit=20`

| Group | Prefix | Auth | Notes |
|---|---|---|---|
| Auth | `/auth` | Public (except `/logout`, `/change-password`) | Register, login, refresh, logout, forgot/reset/change password |
| Tasks | `/tasks` | Required | Full CRUD + `POST /tasks/:id/comments` + `GET /tasks/stats` |
| Projects | `/projects` | Required | manager+ to create; admin to archive |
| Users | `/users` | Required | Admin-only list; self or admin for PATCH |
| Notifications | `/notifications` | Required | List + mark-as-read |

**Token TTLs:** access token **15 min** · refresh token **7 days** (httpOnly cookie, rotated on each refresh)

### Notable endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/tasks/stats` | Returns `{ todo, in_progress, review, done }` counts in one query — used by the dashboard |
| `GET` | `/tasks/:id?comment_page=1&comment_limit=20` | Paginated comments on a single task (default page 1, up to 100 per page) |

---

## Data Model

```
Users ──< Projects
  │           │
  │       Tasks >── Comments
  │           │
  └──────< Notifications
```

| Model | Key fields |
|---|---|
| User | `role` (admin/manager/member), `is_active`, `failed_login_attempts`, `locked_until` |
| Project | `status` (active/archived/completed), `owner_id` |
| Task | `status` (todo/in_progress/review/done), `priority` (low/medium/high/critical), `assignee_id`, `reporter_id`, `is_deleted` |
| Comment | `task_id`, `author_id`, `is_deleted` |
| Notification | `recipient_id`, `type`, `is_read`, `reference_id` |

---

## Security

| Control | Implementation |
|---|---|
| Authentication | JWT (HS256) — access token in memory only (never persisted), refresh token in `httpOnly; SameSite=Strict` cookie |
| Cookie scope | `Secure` flag on in staging + production (`NODE_ENV !== development`); path scoped to `/v1/auth` |
| Token invalidation | Logout blocklists `jti` in Redis (TTL = remaining token lifetime); refresh tokens rotated on every use via cursor-based `SCAN` |
| RBAC | `admin > manager > member` enforced at middleware level (`requireRole`) |
| Rate limiting | 100 req/min global · 10 req/min on `/auth` — Redis-backed per IP |
| Input validation | Joi schemas on all POST/PUT/PATCH routes + query params before service layer; `stripUnknown: true` |
| SQL injection | Sequelize parameterised queries only — no raw string interpolation |
| Password hashing | bcrypt cost factor 12 |
| Account lockout | 5 consecutive failures → 30-minute block |
| Security headers | Helmet — HSTS 1 year + preload, CSP (`default-src 'self'`, no `unsafe-inline`), X-Frame-Options |
| CORS | Whitelist only; `X-Requested-With` required as CSRF mitigation; no-origin requests blocked outside `development` |
| Production build guard | `VITE_API_BASE_URL` and `VITE_SOCKET_URL` throw at startup if absent — prevents credentials over plain HTTP |
| Secrets | AWS Secrets Manager — never committed to SCM |

---

## CI / CD

| Event | Pipeline |
|---|---|
| Push to any feature branch | Lint + test + `npm audit` (CI) |
| PR to `main` / `develop` | Same as above (required to merge) |
| Merge to `main` | Build server Docker image → push to ECR → deploy to **staging** (automatic) |
| Manual `workflow_dispatch` | Deploy specific ECR image tag to **production** (requires GitHub environment approval) |

**Rollback:** trigger `workflow_dispatch` with the previous ECR image tag.

---

## Environments

| Environment | Infrastructure | Data |
|---|---|---|
| Development | Docker Compose (local) | Seed data |
| Staging | AWS EC2 t3.small | Anonymised production clone |
| Production | AWS EC2 t3.small ×2 behind ALB | Live data — AES-256 encrypted at rest |

Migrations run as a pre-deploy step in the pipeline via Sequelize CLI.
