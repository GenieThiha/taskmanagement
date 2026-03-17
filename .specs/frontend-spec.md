# Front-End Specification

## Stack

| Concern | Library | Version |
|---------|---------|---------|
| Framework | React | 18.3 |
| Build tool | Vite | 5.x |
| Styling | Tailwind CSS | 3.4 |
| State management | Zustand | 4.x |
| Routing | React Router | v6 |
| HTTP client | Axios | — |
| Charts | Recharts | — |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable | — |
| Notifications (toast) | React Hot Toast | — |
| Real-time | Socket.io-client | — |
| Testing | Vitest + React Testing Library | — |

---

## Project Structure

```
client/src/
├── api/
│   ├── axios-instance.ts        # Axios instance, base URL, interceptors
│   ├── auth-api.ts
│   ├── task-api.ts
│   ├── user-api.ts
│   ├── project-api.ts
│   └── notification-api.ts
├── router/
│   ├── app-router.tsx           # Route definitions
│   └── protected-route.tsx      # JWT presence guard → redirect /login
├── modules/
│   ├── auth/
│   │   ├── pages/
│   │   │   ├── login-page.tsx
│   │   │   ├── register-page.tsx
│   │   │   └── reset-password-page.tsx
│   │   ├── hooks/
│   │   │   └── use-auth.ts      # login/logout/refresh helpers
│   │   └── auth-store.ts        # Zustand: current user, access token
│   └── tasks/
│       ├── pages/
│       │   ├── task-list-page.tsx
│       │   └── task-detail-page.tsx
│       ├── components/
│       │   ├── task-form.tsx
│       │   ├── task-card.tsx
│       │   ├── kanban-board.tsx  # @dnd-kit drag-and-drop
│       │   └── kanban-column.tsx
│       └── task-store.ts        # Zustand: tasks, filters, optimistic updates
├── dashboard/
│   ├── dashboard-page.tsx
│   ├── kpi-card.tsx
│   ├── activity-feed.tsx
│   └── completion-chart.tsx     # Recharts
├── notifications/
│   ├── notification-bell.tsx    # Unread count badge
│   ├── notification-list.tsx
│   └── use-socket.ts            # Socket.io-client connection + event handlers
├── projects/
│   ├── project-list-page.tsx
│   └── project-form.tsx
├── users/
│   ├── user-list-page.tsx       # Admin only
│   └── user-profile-page.tsx
└── shared/
    ├── components/
    │   ├── button.tsx
    │   ├── input.tsx
    │   ├── modal.tsx
    │   ├── badge.tsx            # status / priority colour badges
    │   └── avatar.tsx
    └── utils/
        ├── token.ts             # get/clear access token from memory
        └── format-date.ts
```

---

## Routing

```
/                    → redirect to /dashboard (if authed) or /login
/login               → LoginPage          (public)
/register            → RegisterPage       (public)
/reset-password      → ResetPasswordPage  (public)
/dashboard           → DashboardPage      (protected)
/tasks               → TaskListPage       (protected)
/tasks/:id           → TaskDetailPage     (protected)
/projects            → ProjectListPage    (protected)
/users               → UserListPage       (protected, admin only)
/users/:id           → UserProfilePage    (protected)
```

`ProtectedRoute` checks for a valid access token in the Zustand auth store. If absent, redirects to `/login` with the original path saved in `location.state.from` for post-login redirect.

---

## Auth & Token Strategy

- **Access token** stored in Zustand store (in-memory only — not localStorage, not sessionStorage)
- **Refresh token** stored in httpOnly cookie (set by server; JS cannot read it)
- On app load: call `POST /auth/refresh` to silently restore session from cookie
- **Axios interceptor:** attaches `Authorization: Bearer <token>` to every request
- On `401` response: interceptor calls `POST /auth/refresh` once, retries the original request; if refresh also fails, clears auth state and redirects to `/login`

---

## Zustand Stores

### auth-store.ts

```ts
interface AuthState {
  user: { id: string; email: string; full_name: string; role: Role } | null
  accessToken: string | null
  setAuth: (user, token) => void
  clearAuth: () => void
}
```

### task-store.ts

```ts
interface TaskState {
  tasks: Task[]
  filters: { status?, priority?, assignee_id?, project_id? }
  setTasks: (tasks: Task[]) => void
  updateTaskStatus: (id: string, status: TaskStatus) => void  // optimistic update
  setFilters: (filters) => void
}
```

---

## Kanban Board (@dnd-kit)

- Four columns: `todo`, `in_progress`, `review`, `done`
- Each column is a `SortableContext` with vertical list strategy
- Dragging a card between columns calls `PATCH /tasks/:id` with `{ status: <target-column> }` optimistically — rollback on API error
- Uses `@dnd-kit/core` `DndContext` + `@dnd-kit/sortable` `useSortable`

---

## Real-Time Notifications (Socket.io-client)

```ts
// use-socket.ts
const socket = io(API_BASE_URL, {
  auth: { token: accessToken },
  autoConnect: false,
})

// Events to handle:
socket.on('notification:new', (notification) => {
  // add to notification store
  // trigger React Hot Toast
})
```

- Connect after successful login; disconnect on logout
- Server rooms: each user joins room `user:<id>` on connection
- On reconnect: `GET /notifications` to sync missed unread count

---

## Dashboard (Recharts)

| Widget | Chart type | Data source |
|--------|-----------|------------|
| Task status breakdown | Pie chart | GET /tasks (grouped by status) |
| Task completion over time | Line chart | GET /tasks (grouped by updated_at week) |
| Activity feed | Timeline list | GET /notifications (recent) |
| KPI cards | Stat cards | Derived from task counts |

---

## Testing (Vitest + React Testing Library)

```bash
# from client/
npm test              # run all tests (Vitest)
npm test auth         # run files matching "auth"
npm run coverage      # coverage report
```

**Coverage targets:**
- Auth hooks and token logic: 90%+
- Axios interceptor (token refresh flow): 90%+
- Zustand store actions: 80%+
- Route guard logic: 80%+

Test files co-located with source: `auth-store.test.ts`, `use-auth.test.ts`, etc.

---

## Environment Variables (client)

```
VITE_API_BASE_URL=https://api.tma.internal/v1
VITE_SOCKET_URL=https://api.tma.internal
```

Set in `.env.development` and `.env.production`. Never prefix with anything other than `VITE_`.
