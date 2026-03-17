import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'member';
  is_active: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => set({ user, accessToken }),
      clearAuth: () => set({ user: null, accessToken: null }),
      setAccessToken: (token) => set({ accessToken: token }),
    }),
    {
      name: 'tma-auth',
      // Access token must NOT be persisted to localStorage (XSS risk).
      // It lives in memory only. User profile is safe to persist for UX.
      partialize: (state) => ({ user: state.user }),
    }
  )
);
