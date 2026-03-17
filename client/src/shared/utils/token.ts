import { useAuthStore } from '../../modules/auth/auth-store';

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

export function clearAccessToken(): void {
  useAuthStore.getState().clearAuth();
}
