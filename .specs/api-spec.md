# API Specification

## Conventions

- **Base URL:** `https://api.tma.internal/v1`
- **Content-Type:** `application/json` on all requests and responses
- **Authentication:** `Authorization: Bearer <access_token>` on all protected endpoints
- **Error format:** RFC 7807 Problem Details

```json
{
  "type": "https://api.tma.internal/errors/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Task with id 'abc' does not exist."
}
```

- **Pagination** (list endpoints): `?page=1&limit=20`
- **Response envelope** (list endpoints):

```json
{
  "data": [...],
  "meta": { "page": 1, "limit": 20, "total": 84 }
}
```

---

## Auth Endpoints

No `Authorization` header required unless marked **Bearer**.

### POST /auth/register

Register a new user account.

**Body:**
```json
{
  "email": "string (email format)",
  "password": "string (min 8 chars, 1 uppercase, 1 digit)",
  "full_name": "string (max 100)"
}
```

**Response:** `201 Created`
```json
{ "id": "uuid", "email": "string", "full_name": "string", "role": "member" }
```

---

### POST /auth/login

Authenticate and receive JWT tokens.

**Body:**
```json
{ "email": "string", "password": "string" }
```

**Response:** `200 OK`
```json
{
  "access_token": "string (JWT, 15 min TTL)",
  "token_type": "Bearer"
}
```

Refresh token is set as an httpOnly cookie (`refresh_token`, 7 days).

**Error cases:**
- `401` — invalid credentials
- `423` — account locked (include `locked_until` in response detail)

---

### POST /auth/refresh

Exchange refresh token cookie for a new access token.

**Auth:** refresh token cookie (automatic)

**Response:** `200 OK`
```json
{ "access_token": "string", "token_type": "Bearer" }
```

---

### POST /auth/logout

Invalidate refresh token in Redis.

**Auth:** Bearer

**Response:** `204 No Content`

---

### POST /auth/forgot-password

Trigger password reset email via AWS SES.

**Body:**
```json
{ "email": "string" }
```

**Response:** `200 OK` (always — do not reveal whether email exists)

---

### PATCH /auth/reset-password

Complete password reset using the emailed token.

**Body:**
```json
{ "token": "string", "new_password": "string (min 8 chars, 1 uppercase, 1 digit)" }
```

**Response:** `200 OK`

---

## Task Endpoints

All require Bearer auth.

### GET /tasks

List tasks with optional filters.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| project_id | UUID | Filter by project |
| status | string | `todo\|in_progress\|review\|done` |
| priority | string | `low\|medium\|high\|critical` |
| assignee_id | UUID | Filter by assignee |
| page | int | Default 1 |
| limit | int | Default 20, max 100 |

**Response:** `200 OK` — paginated list of task objects

---

### POST /tasks

Create a new task.

**Body:**
```json
{
  "title": "string (max 200)",
  "description": "string (optional)",
  "project_id": "uuid",
  "assignee_id": "uuid (optional)",
  "priority": "low|medium|high|critical (default: medium)",
  "due_date": "ISO 8601 date (optional)"
}
```

**Response:** `201 Created` — task object

---

### GET /tasks/:id

Retrieve a single task with its comments.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "string",
  "priority": "string",
  "due_date": "string",
  "project": { "id": "uuid", "name": "string" },
  "assignee": { "id": "uuid", "full_name": "string" },
  "reporter": { "id": "uuid", "full_name": "string" },
  "comments": [...],
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601"
}
```

---

### PUT /tasks/:id

Full update of a task record.

**Body:** same fields as POST /tasks (all required)

**Response:** `200 OK` — updated task object

---

### PATCH /tasks/:id

Partial update (e.g. status-only change).

**Body:** any subset of task fields

**Response:** `200 OK` — updated task object

---

### DELETE /tasks/:id

Soft-delete a task (`is_deleted = true`).

**Response:** `204 No Content`

---

### POST /tasks/:id/comments

Add a comment to a task.

**Body:**
```json
{ "body": "string (max 2000)" }
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "body": "string",
  "author": { "id": "uuid", "full_name": "string" },
  "created_at": "ISO 8601"
}
```

---

## User Endpoints

### GET /users

List all users. **Admin only.**

**Response:** `200 OK` — paginated list (excludes `password_hash`)

---

### GET /users/:id

Retrieve a user profile.

**Response:** `200 OK` — user object (excludes `password_hash`)

---

### PATCH /users/:id

Update user profile or role.

- `self` can update `full_name` only
- `admin` can update `full_name` and `role`

**Body:**
```json
{
  "full_name": "string (optional)",
  "role": "admin|manager|member (admin only)"
}
```

**Response:** `200 OK` — updated user object

---

## Project Endpoints

### GET /projects

List projects accessible to the caller.

**Response:** `200 OK` — paginated list of project objects

---

### POST /projects

Create a new project. **manager or admin only.**

**Body:**
```json
{
  "name": "string (max 150)",
  "description": "string (optional)"
}
```

**Response:** `201 Created` — project object

---

### PUT /projects/:id

Update project metadata. **owner or admin only.**

**Body:**
```json
{
  "name": "string",
  "description": "string",
  "status": "active|completed"
}
```

**Response:** `200 OK` — updated project object

---

### DELETE /projects/:id

Archive a project. **admin only.** Sets `status = 'archived'`.

**Response:** `204 No Content`

---

## Notification Endpoints

### GET /notifications

Get the caller's notifications (unread first, max 50).

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "task_assigned",
      "message": "string",
      "reference_id": "uuid",
      "reference_type": "task",
      "is_read": false,
      "created_at": "ISO 8601"
    }
  ],
  "meta": { "unread_count": 3 }
}
```

---

### PATCH /notifications/:id

Mark a notification as read. **recipient only.**

**Body:** `{ "is_read": true }`

**Response:** `200 OK`

---

## HTTP Status Code Reference

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Resource created |
| 204 | Success, no body |
| 400 | Validation error (Joi) |
| 401 | Missing or invalid JWT |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 423 | Account locked |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
