# Security Specification

All requirements in this document are non-negotiable and derived from the approved HLD (TMA_HLD_Waterfall.pdf, Section 8).

---

## Authentication & Authorisation

| Requirement | Implementation |
|-------------|----------------|
| JWT access token TTL | 15 minutes; signed with `JWT_SECRET` |
| JWT refresh token TTL | 7 days; signed with separate `REFRESH_SECRET` |
| Refresh token storage | Redis only — key `refresh:<user_id>` with TTL 7d |
| Logout invalidation | Access token `jti` added to Redis blocklist; refresh token deleted |
| JWT blocklist check | `auth-guard.ts` checks Redis `blocklist:<jti>` on every protected request |
| RBAC | Roles: `admin > manager > member`; enforced in `require-role.ts` middleware |
| Password hashing | `bcrypt` with **cost factor 12** |
| Account lockout | After **5 consecutive failed logins**: `locked_until = NOW() + 30 min`; return HTTP 423 |
| Token rotation | New access + refresh tokens issued on every `/auth/refresh` call; old refresh token deleted |

---

## Transport & API Security

| Requirement | Implementation |
|-------------|----------------|
| HTTPS everywhere | CloudFront + ACM certificate; HTTP → HTTPS redirect at CloudFront level |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` via Helmet |
| Security headers | Helmet sets `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy` |
| CORS | Restricted to whitelisted origins in `CORS_ORIGINS` env var; `credentials: true` for cookie support |
| Rate limiting (global) | **100 req/min per IP** via `express-rate-limit` with Redis store |
| Rate limiting (auth) | **10 req/min per IP** on all `/auth` endpoints |
| Input validation | All `POST`, `PUT`, `PATCH` bodies validated with **Joi schemas** before reaching service layer |
| SQL injection | Sequelize **parameterised queries** exclusively — never use `sequelize.query()` with string interpolation |

---

## Data Security

| Requirement | Implementation |
|-------------|----------------|
| PII storage | All PII in PostgreSQL within AWS VPC private subnet — not publicly accessible |
| Encryption at rest | AWS RDS storage encryption (AES-256) |
| Secrets management | All secrets loaded from **AWS Secrets Manager** at runtime; never committed to SCM or `.env` files in production |
| Password exposure | `password_hash` excluded from all Sequelize model `defaultScope` to prevent accidental serialisation |
| Soft delete | Tasks and users are soft-deleted (`is_deleted` / `is_active` flags); no hard deletes |
| Audit trail | Winston + Morgan logs all requests with user ID, IP, method, path, status code |

---

## RBAC Enforcement Matrix

| Action | member | manager | admin |
|--------|--------|---------|-------|
| Register / Login | ✓ | ✓ | ✓ |
| Create task | ✓ | ✓ | ✓ |
| Update own task | ✓ | ✓ | ✓ |
| Update any task | ✗ | ✓ | ✓ |
| Delete (soft) task | ✗ | ✓ | ✓ |
| Create project | ✗ | ✓ | ✓ |
| Update own project | ✗ | ✓ (owner) | ✓ |
| Archive project | ✗ | ✗ | ✓ |
| List all users | ✗ | ✗ | ✓ |
| Update own profile | ✓ | ✓ | ✓ |
| Update any profile / role | ✗ | ✗ | ✓ |

---

## Security Checklist for Implementation

Before each release, verify:

- [ ] `password_hash` not present in any API response (add test assertion)
- [ ] All new `POST`/`PUT`/`PATCH` routes have a Joi schema applied
- [ ] New routes behind `authGuard`; role requirements explicit in router
- [ ] CORS `CORS_ORIGINS` list reviewed and contains only expected domains
- [ ] No secrets in code or `.env` files tracked by git
- [ ] `npm audit` passes with no high/critical vulnerabilities (enforced in CI)
- [ ] Rate limiter covers any new public endpoints
