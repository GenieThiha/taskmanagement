import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../auth-store';
import * as authApi from '../../../api/auth-api';

export function useAuth() {
  const { user, accessToken, setAuth, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  // On mount: if the user profile is persisted but the in-memory token is gone
  // (e.g. page reload), silently restore the session via the httpOnly refresh
  // token cookie. No localStorage reads needed.
  useEffect(() => {
    if (user && !accessToken) {
      authApi
        .refresh()
        .then((tokens) => {
          setAuth(user, tokens.accessToken);
        })
        .catch(() => {
          clearAuth();
        });
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login({ email, password });
      // Refresh token is stored as an httpOnly cookie by the server — never touch localStorage.
      setAuth(result.user, result.accessToken);
      toast.success(`Welcome back, ${result.user.full_name}!`);
      navigate('/dashboard');
    },
    [setAuth, navigate]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors during logout
    }
    clearAuth();
    navigate('/login');
    toast.success('Logged out successfully');
  }, [clearAuth, navigate]);

  const register = useCallback(
    async (data: { email: string; password: string; full_name: string }) => {
      await authApi.register(data);
      toast.success('Account created! Please log in.');
      navigate('/login');
    },
    [navigate]
  );

  return { user, accessToken, login, logout, register, isAuthenticated: !!accessToken };
}
