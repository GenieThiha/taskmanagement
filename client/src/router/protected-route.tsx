import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../modules/auth/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'manager' | 'member';
}

const roleHierarchy: Record<string, number> = {
  admin: 3,
  manager: 2,
  member: 1,
};

// Decode the JWT payload and check the `exp` claim (no signature verification —
// that happens on the server; this is purely a UX redirect to avoid visible 401s).
// JWTs use base64url (- and _ instead of + and /); normalise before calling atob.
function isTokenExpired(token: string): boolean {
  try {
    const base64url = token.split('.')[1];
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true; // fail-closed: treat unreadable tokens as expired
  }
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { accessToken, user } = useAuthStore();
  const location = useLocation();

  if (!accessToken || isTokenExpired(accessToken)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && user) {
    const userLevel = roleHierarchy[user.role] ?? 0;
    const requiredLevel = roleHierarchy[requiredRole] ?? 0;
    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
