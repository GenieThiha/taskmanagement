# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Task Management Web Application (TMA-2026)** — an internal team task manager for ≤50 users, built following the Waterfall SDLC. The implementation is **complete**. The application is running and deployable.

Go-live target: Q3 2026. Current focus: testing and hardening before production release.

---

## Architecture

Three-tier client-server architecture. Each tier is independently deployable and containerised.

```
[Browser / SPA] ── HTTPS ──> CloudFront / S3 (production)
                                    │ REST/JSON
                              Node.js / Express API (port 3000)
                              [Auth MW] [Task SVC] [User SVC] [Notif SVC]
                                    │                     │
                             PostgreSQL 16            Redis 7
```

| Tier             | Technology                        | Role |
|------------------|-----------------------------------|------|
| Client           | React 18, Tailwind CSS 3.4, Zustand 4.x | SPA; local state; calls REST API |
| Presentation     | CloudFront + S3 (prod) / Vite dev server (local) | Serves compiled SPA bundles; TLS termination |
| Application      | Node.js 20 LTS, Express 4.18      | Business logic, auth, validation, routing |
| Data             | PostgreSQL 16 (AWS RDS db.t3.m)   | Persistent relational storage |
| Cache            | Redis 7 (AWS ElastiCache)         | JWT blocklist, refresh tokens, rate-limit counters |

---

## Technology Stack

| Concern          | Choice              | Version |
|------------------|---------------------|---------|
| Front-end build  | Vite                | 5.x     |
| State management | Zustand             | 4.x     |
| Charts           | Recharts            | —       |
| Drag-and-drop    | @dnd-kit/core + @dnd-kit/sortable | — |
| ORM              | Sequelize           | 6.x     |
| Auth tokens      | jsonwebtoken        | 9.x     |
| Password hashing | bcrypt (cost 12)    | —       |
| Input validation | Joi                 | —       |
| Security headers | Helmet              | —       |
| Rate limiting    | express-rate-limit (Redis-backed) | — |
| Logging          | Winston + Morgan    | —       |
| Email            | Nodemailer → Mailpit (dev) / AWS SES (prod) | — |
| Scheduler        | node-cron           | —       |
| Container        | Docker 25           | —       |
| Local dev        | Docker Compose 2.x  | —       |
| CI/CD            | GitHub Actions      | —       |
| Cloud            | AWS (EC2 t3.small, RDS, ElastiCache, CloudFront, Route53) | ap-southeast-1 |

---

## Monorepo Layout

```
/
├── client/          # React 18 SPA (Vite)
│   └── src/
│       ├── router/          # React Router v6; protected routes via JWT check
│       ├── modules/
│       │   ├── auth/        # hooks, Zustand store, login/register/reset/forgot pages
│       │   └── tasks/       # Zustand store; Kanban board (drag-and-drop); task forms
│       ├── dashboard/       # Recharts KPI cards + activity feed
│       ├── notifications/   # Socket.io-client hook; notification bell
│       ├── projects/        # project list + form
│       ├── users/           # user list (admin) + profile page
│       └── api/             # Axios instance; Bearer token interceptor + 401 refresh retry
├── server/          # Node.js / Express API
│   └── src/
│       ├── services/
│       │   ├── auth/        # JWT issue/validate/refresh/change-password; bcrypt
│       │   ├── tasks/       # Full task lifecycle via Sequelize
│       │   ├── users/       # Profiles, roles, team membership
│       │   ├── projects/    # CRUD + archive
│       │   └── notifications/ # node-cron + Nodemailer; in-app queue; Socket.io emit
│       ├── middleware/      # Helmet, CORS, rate-limiter, authGuard, requireRole, validate
│       ├── socket/          # Socket.io server — JWT + Redis blocklist auth; room management
│       ├── models/          # Sequelize models: User, Project, Task, Comment, Notification
│       ├── config/          # env, database, redis, mailer (singletons)
│       └── logger/          # Winston JSON + Morgan request logs
├── db/
│   ├── migrations/          # Sequelize CLI migrations
│   └── seeders/             # Development seed data (6 users, shared password: Password123!)
├── .github/
│   └── workflows/
│       ├── ci.yml           # Lint + test + audit on every feature branch / PR
│       └── deploy.yml       # Build → ECR → staging (auto) → production (manual gate)
└── docker-compose.yml       # Local dev: mailpit + postgres + redis + server + client
```

All source files use **kebab-case** naming.

---

## Dev Commands

```bash
# Local dev (all services via Docker Compose)
docker compose up --build

# Front-end (from client/)
npm run dev        # Vite dev server with HMR on :5173
npm run build      # Production bundle
npm run lint       # ESLint

# Back-end (from server/)
npm run dev        # nodemon on :3000
npm run lint

# Database (from server/)
npx sequelize-cli db:migrate          # apply all pending
npx sequelize-cli db:migrate:undo     # rollback one
npx sequelize-cli db:seed:all         # load seed data

# Tests
npm test                              # all tests
npm run test:coverage                 # with coverage report
```

CI runs lint + unit tests on every feature branch push (GitHub Actions). PR merge to `main` builds and pushes a Docker image to Amazon ECR, then auto-deploys to staging. Production deploy requires a manual approval gate.

---

## Local Services (Docker Compose)

| Service | URL | Notes |
|---------|-----|-------|
| React SPA | http://localhost:5173 | Vite HMR |
| Express API | http://localhost:3000 | nodemon hot-reload |
| Mailpit (web UI) | http://localhost:8025 | Catches all outbound email in dev |
| PostgreSQL | localhost:5433 | Host port 5433 avoids clash with local installs |
| Redis | localhost:6379 | Standard port |

> **Email in dev:** All emails (password reset, notifications) are intercepted by **Mailpit** (`axllent/mailpit` image — ARM64 compatible). No SES credentials needed locally. The Docker service is named `mailhog` for legacy reasons but runs the Mailpit image.

---

## Seed Credentials

All seed users share the password `Password123!`.

| Role    | Email                        |
|---------|------------------------------|
| admin   | admin@tma.internal           |
| manager | bob.manager@tma.internal     |
| manager | carol.manager@tma.internal   |
| member  | david.member@tma.internal    |
| member  | eve.member@tma.internal      |
| member  | frank.member@tma.internal    |

---

## API Conventions

- Base URL: `https://api.tma.internal/v1` (local: `http://localhost:3000/v1`)
- All requests/responses: `Content-Type: application/json`
- Auth: `Authorization: Bearer <access_token>` (except public `/auth/*` endpoints)
- Error shape: RFC 7807 Problem Details
- Pagination: `?page=1&limit=20` on list endpoints
- Response envelope: `{ "data": <payload>, "meta": { "page", "limit", "total" } }`
- Access token TTL: **15 minutes**; refresh token TTL: **7 days** (httpOnly cookie, rotated on refresh)

### Endpoint groups

| Group         | Prefix             | Auth | Notes |
|---------------|--------------------|------|-------|
| Auth          | `/auth`            | Public (except `/logout`, `/change-password`) | Register, login, refresh, logout, forgot/reset/change password |
| Tasks         | `/tasks`           | Required | Full CRUD + `POST /tasks/:id/comments` + `GET /tasks/stats` |
| Projects      | `/projects`        | Required | manager+ to create; admin to archive |
| Users         | `/users`           | Required | Admin-only list; self or admin for PATCH |
| Notifications | `/notifications`   | Required | List + mark-as-read |

---

## Data Model

Core entities: **Users**, **Projects**, **Tasks**, **Comments**, **Notifications**. All tables include `created_at` and `updated_at` managed by Sequelize hooks.

- **Users**: `role` ENUM `admin | manager | member`; soft-delete via `is_active`; password stored as bcrypt hash only; `failed_login_attempts` + `locked_until` for account lockout
- **Tasks**: `status` ENUM `todo | in_progress | review | done`; `priority` ENUM `low | medium | high | critical`; FK to `projects` and `users` (assignee + reporter); soft-delete via `is_deleted`
- **Projects**: `status` ENUM `active | archived | completed`; `owner_id` FK → users
- **Comments**: FK to `tasks` and `users`; soft-delete via `is_deleted`
- **Notifications**: FK to `users` (recipient); `type` ENUM `task_assigned | task_updated | task_commented | task_due_soon`; `is_read` flag

---

## Security Constraints

These are non-negotiable requirements from the HLD:

- JWT access tokens expire in **15 min**; refresh tokens in **7 days**; logout must blocklist `jti` in Redis and delete all `refresh:<user_id>:*` keys
- RBAC hierarchy: `admin > manager > member` — enforced at middleware (`requireRole`) **and** service layer
- Rate limit: **100 req/min per IP** globally; **10 req/min** on `/auth` endpoints (Redis-backed)
- All POST/PUT/PATCH input validated with **Joi schemas** before hitting service layer; `stripUnknown: true`
- Use **Sequelize parameterised queries** exclusively — no raw SQL string interpolation
- Passwords hashed with **bcrypt cost factor 12**
- Account lockout after **5 consecutive failed logins** (30-minute block); HTTP 423
- CORS restricted to whitelisted origins only (`CORS_ORIGINS` env var); wildcard `*` prohibited
- Environment secrets via **AWS Secrets Manager** only — never committed to SCM
- Socket.io auth middleware **fails closed** if Redis is unavailable

---

## Environments

| Environment | Infrastructure              | Data |
|-------------|----------------------------|------|
| Development | Docker Compose (local)     | Seed data only |
| Staging     | AWS EC2 t3.small           | Anonymised prod clone |
| Production  | AWS EC2 t3.small ×2 (ALB)  | Live data (AES-256 encrypted at rest) |

Database migrations run via Sequelize CLI as a **pre-deploy step** in the CI/CD pipeline. Rollback by re-deploying the previous ECR image tag via `workflow_dispatch`.
