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
├── docker-compose.yml       # Local dev: postgres + redis + server + client
└── TMA_HLD_Waterfall.pdf    # Authoritative HLD reference
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

| Service | URL |
|---|---|
| React SPA | http://localhost:5173 |
| Express API | http://localhost:3000 |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6379 |

The server starts with **nodemon + ts-node** (hot-reload on save).
The client starts the **Vite dev server** (HMR on save).
The client waits for the server `/health` check before starting.

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

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL connection string |
| `REDIS_URL` | server | Redis connection string |
| `JWT_SECRET` | server | Access token signing key |
| `REFRESH_SECRET` | server | Refresh token signing key |
| `APP_URL` | server | Base URL for password reset emails |
| `CORS_ORIGINS` | server | Comma-separated allowed origins |
| `SES_SMTP_USER` | server | AWS SES SMTP username |
| `SES_SMTP_PASS` | server | AWS SES SMTP password |
| `VITE_API_BASE_URL` | client | API base URL (`/v1`) |
| `VITE_SOCKET_URL` | client | Socket.io server URL |

---

## Testing

```bash
# Server
cd server
npm test                        # Jest (all suites)
npm run test:coverage           # with coverage report

# Client
cd client
npm test                        # Vitest (all suites)
npm run coverage
```

---

## API Reference

**Base URL:** `https://api.tma.internal/v1`
**Auth:** `Authorization: Bearer <access_token>` on all non-auth routes
**Content-Type:** `application/json`
**Error shape:** RFC 7807 Problem Details
**Pagination:** `?page=1&limit=20`

| Group | Prefix | Auth | Notes |
|---|---|---|---|
| Auth | `/auth` | Public (except `/logout`) | Register, login, refresh, logout, forgot/reset password |
| Tasks | `/tasks` | Required | Full CRUD + `POST /tasks/:id/comments` |
| Projects | `/projects` | Required | manager+ to create; admin to archive |
| Users | `/users` | Required | Admin-only list; self or admin for PATCH |
| Notifications | `/notifications` | Required | List + mark-as-read |

**Token TTLs:** access token **15 min** · refresh token **7 days** (httpOnly cookie, rotated on each refresh)

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
| Authentication | JWT (HS256) — access token in memory, refresh token in httpOnly cookie |
| Token invalidation | Logout blocklists `jti` in Redis; refresh tokens rotated on every use |
| RBAC | `admin > manager > member` enforced at middleware level (`requireRole`) |
| Rate limiting | 100 req/min global · 10 req/min on `/auth` — Redis-backed per IP |
| Input validation | Joi schemas on all POST/PUT/PATCH routes before service layer |
| SQL injection | Sequelize parameterised queries only — no raw string interpolation |
| Password hashing | bcrypt cost factor 12 |
| Account lockout | 5 consecutive failures → 30-minute block |
| Security headers | Helmet (HSTS, CSP, X-Frame-Options, …) |
| CORS | Whitelist only; `X-Requested-With` required; no-origin blocked outside dev |
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
