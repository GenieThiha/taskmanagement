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
│   ├── app-router.tsx           # Route definitions (all pages lazy-loaded)
│   └── protected-route.tsx      # JWT presence + expiry guard → redirect /login
├── modules/
│   ├── auth/
│   │   ├── pages/
│   │   │   ├── login-page.tsx
│   │   │   ├── register-page.tsx
│   │   │   ├── forgot-password-page.tsx  # lazy-loaded separate chunk
│   │   │   └── reset-password-page.tsx
│   │   ├── hooks/
│   │   │   └── use-auth.ts      # login/logout/register/refresh helpers
│   │   └── auth-store.ts        # Zustand: current user, access token (token not persisted)
│   └── tasks/
│       ├── pages/
│       │   ├── task-list-page.tsx
│       │   └── task-detail-page.tsx
│       ├── components/
│       │   ├── task-form.tsx
│       │   ├── task-card.tsx    # React.memo wrapped
│       │   ├── kanban-board.tsx  # @dnd-kit drag-and-drop; useMemo for grouping
│       │   └── kanban-column.tsx
│       └── task-store.ts        # Zustand: tasks, filters, optimistic updates
├── dashboard/
│   ├── dashboard-page.tsx
│   ├── kpi-card.tsx
│   ├── activity-feed.tsx
│   └── completion-chart.tsx     # Recharts pie chart
├── notifications/
│   ├── notification-bell.tsx    # Unread count badge
│   ├── notification-list.tsx
│   └── use-socket.ts            # Socket.io-client: connect, reconnect on expiry, sync
├── projects/
│   ├── project-list-page.tsx
│   └── project-form.tsx
├── users/
│   ├── user-list-page.tsx       # Admin only
│   └── user-profile-page.tsx    # Self-edit (name); admin also edits role + is_active
└── shared/
    ├── components/
    │   ├── button.tsx
    │   ├── input.tsx
    │   ├── modal.tsx
    │   ├── badge.tsx            # status / priority colour badges
    │   ├── avatar.tsx           # initials + deterministic colour from name
    │   └── theme-toggle.tsx
    ├── stores/
    │   └── theme-store.ts       # Zustand: dark/light mode (persisted)
    └── utils/
        ├── token.ts             # get/clear access token from memory
        └── format-date.ts
```

---

## Routing

```
/                    → redirect to /dashboard (if authed) or /login
/login               → LoginPage           (public)
/register            → RegisterPage        (public)
/forgot-password     → ForgotPasswordPage  (public, lazy-loaded)
/reset-password      → ResetPasswordPage   (public)
/dashboard           → DashboardPage       (protected)
/tasks               → TaskListPage        (protected)
/tasks/:id           → TaskDetailPage      (protected)
/projects            → ProjectListPage     (protected)
/users               → UserListPage        (protected, admin only)
/users/:id           → UserProfilePage     (protected)
```

`ProtectedRoute` checks for a valid, non-expired access token in the Zustand auth store. If absent or expired (checked via JWT `exp` claim — no signature verification, that is server-side), redirects to `/login` with the original path saved in `location.state.from` for post-login redirect. Role-level guards redirect to `/dashboard` on insufficient role.

---

## Auth & Token Strategy

- **Access token** stored in Zustand store (in-memory only — not localStorage, not sessionStorage)
- **Refresh token** stored in httpOnly cookie (set by server; JS cannot read it)
- **User profile** persisted to localStorage via Zustand `persist` middleware (`partialize` excludes `accessToken`)
- On app load: if `user` is in the store but `accessToken` is null (e.g. page reload), call `POST /auth/refresh` to silently restore the session from the httpOnly cookie
- **Axios interceptor:** attaches `Authorization: Bearer <token>` to every request
- On `401` response: interceptor calls `POST /auth/refresh` once using a raw `axios` instance (not `apiClient`, to avoid infinite loops); retries the original request; if refresh also fails, clears auth state and hard-navigates to `/login`
- Concurrent 401s during a refresh are queued and replayed once the new token arrives (no thundering herd)

---

## Zustand Stores

### auth-store.ts

```ts
interface AuthState {
  user: { id: string; email: string; full_name: string; role: Role; is_active: boolean } | null
  accessToken: string | null
  setAuth: (user, token) => void
  clearAuth: () => void
  setAccessToken: (token: string) => void  // used by socket reconnect flow
}
// Persisted to localStorage: user only. accessToken is never persisted (XSS risk).
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
- Task grouping by status is `useMemo`'d — only recomputes when the task list changes, not on drag-over re-renders
- `TaskCard` is wrapped in `React.memo` — re-renders only when its own `task` prop changes
- `PointerSensor` configured with `activationConstraint: { distance: 8 }` to prevent accidental drags on card clicks
- Dragging a card between columns calls `PATCH /tasks/:id` with `{ status: <target-column> }` optimistically — rollback on API error

---

## Real-Time Notifications (Socket.io-client)

```ts
// use-socket.ts
const socket = io(SOCKET_URL, {
  auth: { token: accessToken },
  transports: ['polling', 'websocket'],  // polling first to avoid upgrade race noise
})

socket.on('notification:new', (notification) => {
  // trigger React Hot Toast
  // invoke caller callback to update activity feed / unread count
})

// Token expiry: server registers a setTimeout and calls socket.disconnect(true).
// On forced disconnect, silently refresh the access token. Updating the Zustand
// store triggers the effect to re-run, creating a new socket with the fresh token.
socket.on('disconnect', async (reason) => {
  if (reason === 'io server disconnect') {
    const tokens = await refreshTokens()          // POST /auth/refresh
    needsSyncRef.current = true
    useAuthStore.getState().setAccessToken(tokens.accessToken)
    // Effect re-runs → new socket created automatically
  }
})

// On reconnect after forced disconnect, sync missed notifications.
socket.on('connect', async () => {
  if (needsSyncRef.current) {
    const res = await getNotifications({ limit: 20 })
    res.data.forEach(n => callbackRef.current?.(n))
  }
})
```

- Connect after successful login; disconnect on logout
- Server rooms: each user joins room `user:<id>` on connection
- Access token passed at connection time; server disconnects socket on expiry via `setTimeout`

---

## Dashboard (Recharts)

| Widget | Chart type | Data source |
|--------|-----------|------------|
| Task status breakdown | Pie chart | `GET /tasks/stats` — single aggregated query; do **not** use `GET /tasks` |
| Task completion over time | Line chart | `GET /tasks?status=done` with date range, grouped client-side by week |
| Activity feed | Timeline list | `GET /notifications?limit=10` — server-limited, no client-side slice |
| KPI cards | Stat cards | Derived from `/tasks/stats` response — no separate fetch |

All three fetches (`/tasks/stats`, `/tasks`, `/notifications`) are issued in `Promise.all` on mount. Dashboard shows an error banner with a retry button if any fetch fails.

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
VITE_API_BASE_URL=https://api.tma.internal/v1    # required in production; falls back to http://localhost:3000/v1 in dev
VITE_SOCKET_URL=https://api.tma.internal          # required in production; falls back to http://localhost:3000 in dev
```

Production builds throw at startup if either variable is absent, preventing credentials from being sent over plain HTTP.
