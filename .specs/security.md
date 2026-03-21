# Security Specification

All requirements in this document are non-negotiable and derived from the approved HLD (TMA_HLD_Waterfall.pdf, Section 8).

---

## Authentication & Authorisation

| Requirement | Implementation |
|-------------|----------------|
| JWT access token TTL | 15 minutes; signed with `JWT_SECRET` |
| JWT refresh token TTL | 7 days; signed with separate `REFRESH_SECRET` |
| Refresh token storage | Redis only — key `refresh:<user_id>:<jti>` per session, TTL 7d (supports multiple concurrent devices) |
| Logout invalidation | `jti` and `exp` taken from the already-verified `req.user` payload (no re-decode); blocklist entry set with remaining TTL; all `refresh:<user_id>:*` keys deleted via non-blocking SCAN |
| JWT blocklist check | `auth-guard.ts` checks Redis `blocklist:<jti>` on every protected request; Socket.io auth middleware does the same and **fails closed** if Redis is unavailable |
| RBAC | Roles: `admin > manager > member`; enforced at route level via `require-role.ts` **and** at service layer for resource ownership (e.g. member may only mutate tasks they created) |
| Password hashing | `bcrypt` with **cost factor 12** |
| Account lockout | After **5 consecutive failed logins**: `locked_until = NOW() + 30 min`; return HTTP 423 |
| Token rotation | New access + refresh tokens issued on every `/auth/refresh` call; old refresh token deleted |
| Password reset token | Generated with `crypto.randomBytes(32).toString('hex')` — never a JWT; stored as `SET pwd_reset:<token> <user.id> EX 3600` (1-hour TTL); deleted immediately on use (single-use enforced); all existing refresh tokens invalidated on successful reset |
| Cookie `Secure` flag | `Secure` flag is set on the `refresh_token` cookie in `staging` and `production` (`NODE_ENV !== 'development'`); omitted in local dev only |
| `SameSite` requirement | `refresh_token` cookie must be `SameSite=Strict` in all environments — this is the primary CSRF mitigation and must never be downgraded to `Lax` or `None` |
| Socket.io token expiry | Server registers a `setTimeout(() => socket.disconnect(true), msUntilExpiry)` on connection; client must reconnect with a refreshed token after expiry |
| Registration | Self-registration is open to anyone on the internal network. No email verification is required — new accounts are immediately active with the `member` role. If the access model changes, this must be revisited. |

---

## Transport & API Security

| Requirement | Implementation |
|-------------|----------------|
| HTTPS everywhere | CloudFront + ACM certificate; HTTP → HTTPS redirect at CloudFront level |
| HSTS | `Strict-Transport-Security: max-age=31536000; includeSubDomains` via Helmet |
| Security headers | Helmet sets `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy` |
| CORS | Restricted to whitelisted origins in `CORS_ORIGINS` env var; `credentials: true` for cookie support. Wildcard origin (`*`) is **prohibited** when `credentials: true` — the implementation must reject any `CORS_ORIGINS` value containing `*` at startup |
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
| Inactive user filtering | `is_active = false` users are excluded from all list queries; login is rejected with `401` |
| Audit trail | Winston + Morgan logs all requests with user ID, IP, method, path, status code |

---

## RBAC Enforcement Matrix

| Action | member | manager | admin |
|--------|--------|---------|-------|
| Register / Login | ✓ | ✓ | ✓ |
| View own tasks (assignee or reporter) | ✓ | ✓ | ✓ |
| View any task | ✗ | ✓ | ✓ |
| Create task | ✓ | ✓ | ✓ |
| Update own task | ✓ | ✓ | ✓ |
| Update any task | ✗ | ✓ | ✓ |
| Delete (soft) task | ✗ | ✓ | ✓ |
| Delete own comment | ✓ | ✓ | ✓ |
| Delete any comment | ✗ | ✗ | ✓ |
| Create project | ✗ | ✓ | ✓ |
| Update own project | ✗ | ✓ (owner) | ✓ |
| Archive project | ✗ | ✗ | ✓ |
| List all users | ✗ | ✗ | ✓ |
| View own profile (`GET /users/:id` where id = self) | ✓ | ✓ | ✓ |
| View any profile (`GET /users/:id` where id ≠ self) | ✗ | ✗ | ✓ |
| Update own profile | ✓ | ✓ | ✓ |
| Update any profile / role | ✗ | ✗ | ✓ |

---

## Security Checklist for Implementation

Before each release, verify:

- [ ] `password_hash` not present in any API response (add test assertion)
- [ ] All new `POST`/`PUT`/`PATCH` routes have a Joi schema applied
- [ ] New routes behind `authGuard`; role requirements explicit in router
- [ ] Task list and detail routes enforce member-scoped visibility at service layer
- [ ] Task mutation routes enforce ownership at service layer (member → reporter_id check)
- [ ] Comment delete enforces author-only or admin at service layer
- [ ] New tasks cannot be created under archived projects (service layer check)
- [ ] Password reset tokens generated with `crypto.randomBytes(32)`, stored in Redis with 1-hour TTL, deleted on use
- [ ] `refresh_token` cookie uses `SameSite=Strict` in all environments; `Secure` in staging/production
- [ ] CORS `CORS_ORIGINS` list reviewed, contains only expected domains, and does not include `*`
- [ ] No secrets in code or `.env` files tracked by git
- [ ] `npm audit` passes with no high/critical vulnerabilities (enforced in CI **and** in production deploy gate)
- [ ] Rate limiter covers any new public endpoints
- [ ] Socket.io auth middleware fails closed on Redis errors (never fail open)
- [ ] Socket.io connection `setTimeout` registered to disconnect on access token expiry
- [ ] Error handler uses `SAFE_ERROR_NAMES` allowlist — Sequelize and JWT class names never reach the response
