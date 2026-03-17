# Architecture

## Pattern

Three-tier client-server architecture. Each tier is independently deployable and containerised.

```
┌─────────────────────────────────────────────┐
│  CLIENT TIER                                │
│  [Browser / SPA] ──── HTTPS ────>           │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  PRESENTATION TIER                          │
│  Nginx 1.25 (static host + TLS termination) │
│  Serves compiled React SPA bundles          │
└─────────────────────────────────────────────┘
                    │ REST / JSON
                    ▼
┌─────────────────────────────────────────────┐
│  APPLICATION TIER  (port 3000)              │
│  Node.js 20 LTS / Express 4.18              │
│  ┌───────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth MW   │ │Task SVC  │ │ User SVC  │  │
│  └───────────┘ └──────────┘ └───────────┘  │
│  ┌─────────────────┐ ┌───────────────────┐  │
│  │ Notification SVC│ │ Middleware Stack   │  │
│  └─────────────────┘ └───────────────────┘  │
└─────────────────────────────────────────────┘
          │ SQL                    │ Cache
          ▼                        ▼
┌──────────────────┐    ┌──────────────────────┐
│  DATA TIER       │    │  CACHE TIER           │
│  PostgreSQL 16   │    │  Redis 7              │
│  (AWS RDS)       │    │  (AWS ElastiCache)    │
└──────────────────┘    └──────────────────────┘
```

---

## Tier Summary

| Tier | Technology | Role |
|------|-----------|------|
| Client | React 18, Tailwind CSS 3.4, Zustand 4.x | SPA; local state; calls REST API over HTTPS |
| Presentation | Nginx 1.25 | Serve compiled SPA bundles; TLS termination |
| Application | Node.js 20 LTS, Express 4.18 | Business logic, authentication, data validation, API routing |
| Data | PostgreSQL 16 (AWS RDS db.t3.m) | Persistent relational storage for all domain entities |
| Cache | Redis 7 (AWS ElastiCache) | JWT blocklist, refresh tokens, rate-limit counters |

---

## Front-End Component Map

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Router | React Router v6 | SPA route management; protected routes via JWT presence check |
| Auth Module | Custom hooks + JWT | Login, registration, password reset; token stored in httpOnly cookie |
| Task Module | React + Zustand + @dnd-kit/core | CRUD forms, task list views, drag-and-drop Kanban board |
| Dashboard | Recharts | Summary KPI cards, activity timeline, task completion chart |
| Notification UI | React Hot Toast + Socket.io-client | Real-time in-app alerts via WebSocket; dismissable toast queue |
| API Client | Axios + interceptor | Centralised HTTP client; attaches Bearer token; retries on 401 |

---

## Back-End Service Map

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Auth Service | Express + bcrypt + jsonwebtoken | Issues & validates JWT; manages refresh token rotation |
| Task Service | Express + Sequelize ORM | Full task lifecycle: create, assign, update, delete, filter, sort |
| User Service | Express + Sequelize ORM | User profiles, role assignment, team membership management |
| Notification SVC | node-cron + Nodemailer + Socket.io | Sends email alerts on task events; pushes in-app notifications |
| Middleware Stack | Helmet, CORS, express-rate-limit | Security headers, CORS policy, per-IP rate limiting |
| Logger | Winston + Morgan | Structured JSON logs; request/response audit trail |

---

## Key Data Flows

### Authentication Flow

```
1. User POST /auth/login  →  Auth Service validates bcrypt hash in PostgreSQL
2. On success: JWT access token (15 min) + refresh token (7 days) issued
3. Refresh token stored in Redis; access token returned in response body
4. Client stores access token in memory; refresh token in httpOnly cookie
5. All subsequent requests: Authorization: Bearer <access_token>
6. On 401: Axios interceptor calls POST /auth/refresh → new access token
7. POST /auth/logout: refresh token deleted from Redis
```

### Task CRUD Flow

```
1. Client sends authenticated request to Task Service endpoint
2. JWT auth middleware validates signature and expiry
3. Joi schema validates request body
4. Task Service executes Sequelize ORM query against PostgreSQL
5. Response payload JSON-serialised → HTTP 200/201/204
6. On task assignment or status change: Notification SVC triggered async
   - Nodemailer sends email via AWS SES
   - Socket.io emits event to recipient's room
```

---

## Real-Time Notifications (Socket.io)

- Client connects to Socket.io server on authenticated session
- Server places each user in a private room keyed by `user.id`
- On task events (assign, status change, comment, due-soon) the Notification SVC emits to the target room
- Client receives event and React Hot Toast displays the alert
- Unread count persisted in the `notifications` table; synced on reconnect

---

## Monorepo Layout

```
/
├── client/                    # React 18 SPA (Vite 5)
│   ├── src/
│   │   ├── router/            # React Router v6 config; route guards
│   │   ├── modules/
│   │   │   ├── auth/          # hooks, pages, JWT helpers
│   │   │   └── tasks/         # Zustand store, Kanban board, forms
│   │   ├── dashboard/         # Recharts widgets
│   │   ├── notifications/     # Socket.io-client, toast queue
│   │   ├── api/               # Axios instance + interceptors
│   │   └── shared/            # UI components, utils, types
│   ├── vite.config.ts
│   └── package.json
├── server/                    # Node.js / Express API
│   ├── src/
│   │   ├── services/
│   │   │   ├── auth/
│   │   │   ├── tasks/
│   │   │   ├── users/
│   │   │   └── notifications/
│   │   ├── middleware/        # helmet, cors, rate-limit, auth-guard
│   │   ├── logger/            # winston config, morgan stream
│   │   ├── socket/            # Socket.io server setup + event handlers
│   │   └── app.ts             # Express app factory
│   ├── jest.config.ts
│   └── package.json
├── db/
│   └── migrations/            # Sequelize CLI migration files (kebab-case)
├── docker-compose.yml
└── .github/
    └── workflows/
        ├── ci.yml             # lint + test on feature branch push
        └── deploy.yml         # build → ECR → staging (auto) / prod (manual gate)
```

All source files use **kebab-case** naming (e.g., `auth-service.ts`, `task-store.ts`).
