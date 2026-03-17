import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../modules/auth/auth-store';
import { useAuth } from '../modules/auth/hooks/use-auth';
import { ProtectedRoute } from './protected-route';
import { NotificationBell } from '../notifications/notification-bell';
import { Avatar } from '../shared/components/avatar';

// Route-level code splitting: each page is its own chunk, downloaded on demand.
const LoginPage = lazy(() =>
  import('../modules/auth/pages/login-page').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('../modules/auth/pages/register-page').then((m) => ({ default: m.RegisterPage }))
);
const ResetPasswordPage = lazy(() =>
  import('../modules/auth/pages/reset-password-page').then((m) => ({
    default: m.ResetPasswordPage,
  }))
);
const DashboardPage = lazy(() =>
  import('../dashboard/dashboard-page').then((m) => ({ default: m.DashboardPage }))
);
const TaskListPage = lazy(() =>
  import('../modules/tasks/pages/task-list-page').then((m) => ({ default: m.TaskListPage }))
);
const TaskDetailPage = lazy(() =>
  import('../modules/tasks/pages/task-detail-page').then((m) => ({ default: m.TaskDetailPage }))
);
const ProjectListPage = lazy(() =>
  import('../projects/project-list-page').then((m) => ({ default: m.ProjectListPage }))
);
const UserListPage = lazy(() =>
  import('../users/user-list-page').then((m) => ({ default: m.UserListPage }))
);
const UserProfilePage = lazy(() =>
  import('../users/user-profile-page').then((m) => ({ default: m.UserProfilePage }))
);
const ForgotPasswordPage = lazy(() =>
  import('../modules/auth/pages/forgot-password-page').then((m) => ({
    default: m.ForgotPasswordPage,
  }))
);

function PageLoader() {
  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  // Delegate to useAuth so logout behaviour (API call, clearAuth, navigate,
  // toast) is handled in one place — no duplicate logic alongside the hook.
  const { user, logout: handleLogout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link to="/dashboard" className="text-lg font-bold text-primary-600">
          TMA
        </Link>
        <div className="flex items-center gap-1 ml-2">
          <Link
            to="/dashboard"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Dashboard
          </Link>
          <Link
            to="/tasks"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Tasks
          </Link>
          <Link
            to="/projects"
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
          >
            Projects
          </Link>
          {user?.role === 'admin' && (
            <Link
              to="/users"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md"
            >
              Users
            </Link>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />
          <Link to={`/users/${user?.id}`}>
            <Avatar fullName={user?.full_name ?? 'User'} size="sm" />
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DashboardPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TaskListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TaskDetailPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <AppLayout>
                <ProjectListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AppLayout>
                <UserListPage />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users/:id"
          element={
            <ProtectedRoute>
              <AppLayout>
                <UserProfilePage />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
