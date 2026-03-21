# Deployment Specification

## Infrastructure Overview

**Cloud:** AWS — region `ap-southeast-1`

```
Internet
    │
    ▼
Route53 (DNS)
    │
    ▼
CloudFront (CDN + WAF + TLS termination)
    │
    ├── /static/*  → S3 or EC2 (React SPA)
    │
    └── /v1/*      → Application Load Balancer (ALB)
                         │
                   ┌─────┴─────┐
                   ▼           ▼
             EC2 t3.small  EC2 t3.small    ← Node.js API
             (AZ-a)        (AZ-b)
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
  RDS PostgreSQL 16      ElastiCache Redis 7
  (db.t3.medium)         (cache.t3.micro)
  private subnet         private subnet
```

All EC2, RDS, and ElastiCache resources are inside a **VPC (10.0.0.0/16)** in a private subnet. Only CloudFront and ALB are internet-facing.

---

## Environments

| Environment | Infrastructure | Data | Deploy trigger |
|-------------|---------------|------|----------------|
| Development | Docker Compose (local) | Seed data only | Manual |
| Staging | EC2 t3.small ×1 | Anonymised prod clone | Auto on PR merge to `main` |
| Production | EC2 t3.small ×2 + ALB | Live data (AES-256) | Manual approval gate in GitHub Actions |

---

## Docker Setup

### docker-compose.yml (local dev)

Services:
- `mailhog` — Mailpit SMTP + web UI (ports 1025 / 8025). Service is named `mailhog` for legacy reasons but uses the `axllent/mailpit` image (ARM64 compatible). Open http://localhost:8025 to read caught emails.
- `postgres` — PostgreSQL 16 (host port 5433 → container 5432)
- `redis` — Redis 7 (port 6379)
- `server` — Node.js with nodemon (port 3000); waits for postgres + redis health checks
- `client` — Vite dev server with HMR (port 5173); waits for server `/health`

```yaml
# Key env vars injected into server container:
NODE_ENV: development
DATABASE_URL: postgresql://tma:tma@postgres:5432/tma_dev
REDIS_URL: redis://redis:6379
JWT_SECRET: dev-secret-not-for-production
REFRESH_SECRET: dev-refresh-secret-not-for-production
JWT_EXPIRES_IN: 15m
REFRESH_EXPIRES_IN: 7d
CORS_ORIGINS: http://localhost:5173
APP_URL: http://localhost:5173
SES_REGION: ap-southeast-1
SES_FROM: noreply@tma.internal
# No SES_SMTP_USER / SES_SMTP_PASS — mailer falls back to Mailpit in dev
```

### Dockerfile (server)

Multi-stage build:
1. `builder` stage — install all deps, compile TypeScript
2. `production` stage — copy `dist/`, install production deps only, run as non-root user

```dockerfile
# production stage runs as:
USER node
CMD ["node", "dist/server.js"]
```

---

## CI/CD Pipeline (GitHub Actions)

### ci.yml — triggered on push to any feature branch

```
1. Checkout
2. Install dependencies (npm ci)
3. Run ESLint (client + server)
4. Run tests (Vitest for client, Jest for server)
5. npm audit --audit-level=high
```

PR cannot be merged unless all CI steps pass.

### deploy.yml — triggered on merge to `main`

```
1. Build Docker image (server)
2. Build React SPA (client) → upload to S3 / EC2
3. Push Docker image to Amazon ECR
4. Deploy to staging EC2 (automatic)
   a. Pull new ECR image
   b. Run: npx sequelize-cli db:migrate  ← pre-deploy step
   c. Restart container
5. Run smoke tests against staging
6. Run `npm audit --audit-level=high` against the production build artifacts — pipeline fails if any high/critical vulnerabilities are found
7. [Manual approval gate] — CTO or Lead Architect approves in GitHub Actions UI
8. Deploy to production EC2 instances (rolling, one AZ at a time)
   a. Drain ALB connections on first instance
   b. Run migration (idempotent)
   c. Restart container
   d. Health check before draining second instance
   e. Repeat for second instance
```

---

## Database Migrations

```bash
# Apply pending migrations
npx sequelize-cli db:migrate

# Rollback last migration
npx sequelize-cli db:migrate:undo

# Rollback all
npx sequelize-cli db:migrate:undo:all
```

**Rules:**
- Migrations run automatically in CI/CD as a pre-deploy step
- Every migration must be reversible (`up` and `down` functions)
- Migration files: `YYYYMMDDHHMMSS-<description>.js` in `db/migrations/`
- Test migrations in staging before production; keep rollback scripts ready

---

## Rollback Procedure

If production deploy fails:

1. In GitHub Actions: trigger `workflow_dispatch` on `deploy.yml` with input `image_tag=<previous ECR tag>`
2. Pipeline re-deploys the previous image (skips migration step)
3. If a migration caused data issues: run `npx sequelize-cli db:migrate:undo` manually on RDS

---

## Secrets Management

- All production secrets stored in **AWS Secrets Manager**
- EC2 instances use an IAM role with `secretsmanager:GetSecretValue` permission
- `server/src/config/env.ts` loads secrets at startup and throws if any required var is missing
- `.env` files are for **local development only** and are in `.gitignore`

---

## Health Check

`GET /health` — no auth required

```json
{ "status": "ok", "timestamp": "ISO 8601" }
```

ALB uses this endpoint for instance health checks (interval: 30s, threshold: 2 failures).

---

## Logging & Monitoring

- Structured JSON logs via Winston → shipped to AWS CloudWatch Logs
- Morgan logs every HTTP request (method, path, status, response time, user ID)
- CloudWatch Alarms on: 5xx error rate > 1%, CPU > 80%, memory > 85%
- Dependabot enabled for weekly npm vulnerability audits
