# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Task Management Web Application (TMA-2026)** — an internal team task manager for ≤50 users, built following the Waterfall SDLC. This repository is currently in **Phase 3 — Design (HLD)**. No implementation exists yet; the authoritative design reference is `TMA_HLD_Waterfall.pdf`.

Go-live target: Q3 2026. Next phase: Low-Level Design (LLD), then implementation.

---

## Architecture

Three-tier client-server architecture. Each tier is independently deployable.

```
[Browser / SPA] ── HTTPS ──> Nginx (static host)
                                    │ REST/JSON
                              Node.js / Express API (port 3000)
                              [Auth MW] [Task SVC] [User SVC] [Notif SVC]
                                    │                     │
                             PostgreSQL 16            Redis 7
```

| Tier             | Technology                        | Role |
|------------------|-----------------------------------|------|
| Client           | React 18, Tailwind CSS 3.4, Zustand 4.x | SPA; local state; calls REST API |
| Presentation     | Nginx 1.25                        | Serves compiled SPA bundles; TLS termination |
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
| ORM              | Sequelize           | 6.x     |
| Auth tokens      | jsonwebtoken        | 9.x     |
| Password hashing | bcrypt (cost 12)    | —       |
| Input validation | Joi                 | —       |
| Security headers | Helmet              | —       |
| Rate limiting    | express-rate-limit (Redis-backed) | — |
| Logging          | Winston + Morgan    | —       |
| Email            | Nodemailer          | —       |
| Scheduler        | node-cron           | —       |
| Container        | Docker 25           | —       |
| Local dev        | Docker Compose 2.x  | —       |
| CI/CD            | GitHub Actions      | —       |
| Cloud            | AWS (EC2 t3.small, RDS, ElastiCache, CloudFront, Route53) | ap-southeast-1 |

---

## Intended Monorepo Layout

When implementing, follow this structure:

```
/
├── client/          # React 18 SPA (Vite)
│   └── src/
│       ├── router/      # React Router v6; protected routes via JWT check
│       ├── modules/
│       │   ├── auth/    # Custom hooks + JWT; token in httpOnly cookie
│       │   └── tasks/   # Zustand store; Kanban board (drag-and-drop)
│       ├── dashboard/   # Recharts KPI cards + activity timeline
│       ├── notifications/ # React Toast; WebSocket real-time alerts
│       └── api/         # Axios instance with Bearer token interceptor + 401 retry
├── server/          # Node.js / Express API
│   └── src/
│       ├── services/
│       │   ├── auth/    # JWT issue/validate/refresh; bcrypt
│       │   ├── tasks/   # Full task lifecycle via Sequelize
│       │   ├── users/   # Profiles, roles, team membership
│       │   └── notifications/ # node-cron + Nodemailer; in-app queue
│       ├── middleware/  # Helmet, CORS, rate-limiter, JWT auth MW
│       └── logger/      # Winston structured JSON + Morgan request logs
├── db/
│   └── migrations/  # Sequelize CLI migrations
├── docker-compose.yml
└── .github/workflows/
```

---

## Intended Dev Commands

These commands are to be wired up during implementation:

```bash
# Local dev (all services via Docker Compose)
docker compose up

# Front-end (from client/)
npm run dev        # Vite dev server with HMR
npm run build      # Production bundle
npm run lint       # ESLint

# Back-end (from server/)
npm run dev        # nodemon
npm run lint

# Database migrations (from server/)
npx sequelize-cli db:migrate
npx sequelize-cli db:migrate:undo   # rollback one

# Tests
npm test                       # all tests
npm test -- --grep "auth"      # single suite
```

CI runs lint + unit tests on every feature branch push (GitHub Actions). PR merge to `main` builds and pushes a Docker image to Amazon ECR, then auto-deploys to staging. Production deploy requires a manual approval gate.

---

## API Conventions

- Base URL: `https://api.tma.internal/v1`
- All requests/responses: `Content-Type: application/json`
- Auth: `Authorization: Bearer <access_token>` (except `/auth/*` endpoints)
- Error shape: RFC 7807 Problem Details
- Pagination: `?page=1&limit=20` on list endpoints
- Access token TTL: **15 minutes**; refresh token TTL: **7 days** (stored in Redis)

### Key endpoint groups

| Group    | Prefix       | Notes |
|----------|--------------|-------|
| Auth     | `/auth`      | No auth required on register/login/forgot-password |
| Tasks    | `/tasks`     | Full CRUD + `POST /tasks/:id/comments` |
| Users    | `/users`     | Admin-only for list; self/admin for PATCH |
| Projects | `/projects`  | manager+ to create; admin to archive |

---

## Data Model

Core entities: **Users**, **Projects**, **Tasks**, **Comments**, **Notifications**. All tables include `created_at` and `updated_at` managed by Sequelize hooks.

- **Users**: `role` ENUM `admin | manager | member`; soft-delete via `is_active`; password stored as bcrypt hash only
- **Tasks**: `status` ENUM `todo | in_progress | review | done`; `priority` ENUM `low | medium | high | critical`; FK to `projects` and `users` (assignee + reporter)
- **Projects**: `status` ENUM `active | archived | completed`; `owner_id` FK → users

---

## Security Constraints

These are non-negotiable requirements from the HLD:

- JWT access tokens expire in **15 min**; refresh tokens in **7 days**; logout must invalidate refresh token in Redis
- RBAC hierarchy: `admin > manager > member` — enforce at middleware level
- Rate limit: **100 req/min per IP** globally; **10 req/min** on `/auth` endpoints (Redis-backed)
- All POST/PUT/PATCH input validated with **Joi schemas** before hitting service layer
- Use **Sequelize parameterised queries** exclusively — no raw SQL string interpolation
- Passwords hashed with **bcrypt cost factor 12**
- Account lockout after **5 consecutive failed logins** (30-minute block)
- CORS restricted to whitelisted origins only; reviewed per release
- Environment secrets via **AWS Secrets Manager** only — never committed to SCM

---

## Environments

| Environment | Infrastructure              | Data |
|-------------|----------------------------|------|
| Development | Docker Compose (local)     | Seed data only |
| Staging     | AWS EC2 t3.small           | Anonymised prod clone |
| Production  | AWS EC2 t3.small ×2 (ALB)  | Live data (AES-256 encrypted at rest) |

Database migrations run via Sequelize CLI as a **pre-deploy step** in the CI/CD pipeline. Rollback by re-deploying the previous ECR image tag via `workflow_dispatch`.
