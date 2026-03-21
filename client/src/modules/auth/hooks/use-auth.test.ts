/**
 * use-auth.test.ts
 * Tests for the useAuth hook.
 * auth-api and react-router-dom are mocked so no network calls or navigation occur.
 */

import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../auth-store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

// Mock useNavigate before importing the hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock auth-api
vi.mock('../../../api/auth-api', () => ({
  refresh: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

import { useAuth } from './use-auth';
import * as authApi from '../../../api/auth-api';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ALICE = {
  id: 'user-1',
  email: 'alice@example.com',
  full_name: 'Alice Smith',
  role: 'member' as const,
  is_active: true,
};

// Reset store and mocks before each test
beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Mount-time session restore behaviour
// ---------------------------------------------------------------------------
describe('useAuth — mount effect (session restore)', () => {
  it('calls authApi.refresh() on mount when user is persisted but accessToken is absent', async () => {
    // Simulate a page reload: user in store but no in-memory token
    useAuthStore.setState({ user: ALICE, accessToken: null });
    (authApi.refresh as MockInstance).mockResolvedValue({ accessToken: 'restored-tok' });

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(authApi.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it('calls setAuth with the refreshed token on success', async () => {
    useAuthStore.setState({ user: ALICE, accessToken: null });
    (authApi.refresh as MockInstance).mockResolvedValue({ accessToken: 'restored-tok' });

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(useAuthStore.getState().accessToken).toBe('restored-tok');
    });
  });

  it('calls clearAuth() when refresh fails (session cannot be restored)', async () => {
    useAuthStore.setState({ user: ALICE, accessToken: null });
    (authApi.refresh as MockInstance).mockRejectedValue(new Error('401 Unauthorized'));

    renderHook(() => useAuth());

    await waitFor(() => {
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  it('does NOT call authApi.refresh() when no user is persisted', async () => {
    useAuthStore.setState({ user: null, accessToken: null });

    renderHook(() => useAuth());

    // Give the effect a tick to run
    await act(async () => {});
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it('does NOT call authApi.refresh() when user AND accessToken are both present', async () => {
    useAuthStore.setState({ user: ALICE, accessToken: 'existing-tok' });

    renderHook(() => useAuth());

    await act(async () => {});
    expect(authApi.refresh).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------
describe('useAuth — login()', () => {
  it('calls authApi.login with the provided credentials', async () => {
    (authApi.login as MockInstance).mockResolvedValue({
      user: ALICE,
      accessToken: 'access-tok',
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('alice@example.com', 'SecurePass1');
    });

    expect(authApi.login).toHaveBeenCalledWith({
      email: 'alice@example.com',
      password: 'SecurePass1',
    });
  });

  it('stores user and accessToken via setAuth after a successful login', async () => {
    (authApi.login as MockInstance).mockResolvedValue({
      user: ALICE,
      accessToken: 'access-tok',
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('alice@example.com', 'SecurePass1');
    });

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toEqual(ALICE);
    expect(accessToken).toBe('access-tok');
  });

  it('navigates to /dashboard after a successful login', async () => {
    (authApi.login as MockInstance).mockResolvedValue({
      user: ALICE,
      accessToken: 'access-tok',
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('alice@example.com', 'SecurePass1');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a welcome toast after a successful login', async () => {
    (authApi.login as MockInstance).mockResolvedValue({
      user: ALICE,
      accessToken: 'access-tok',
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('alice@example.com', 'SecurePass1');
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining(ALICE.full_name));
  });

  it('propagates the error thrown by authApi.login so the caller can handle it', async () => {
    (authApi.login as MockInstance).mockRejectedValue(new Error('Invalid credentials'));

    const { result } = renderHook(() => useAuth());

    await expect(
      act(async () => {
        await result.current.login('alice@example.com', 'WrongPass1');
      })
    ).rejects.toThrow('Invalid credentials');

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// logout()
// ---------------------------------------------------------------------------
describe('useAuth — logout()', () => {
  it('calls authApi.logout()', async () => {
    (authApi.logout as MockInstance).mockResolvedValue(undefined);
    useAuthStore.setState({ user: ALICE, accessToken: 'tok' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(authApi.logout).toHaveBeenCalledTimes(1);
  });

  it('clears auth state after logout', async () => {
    (authApi.logout as MockInstance).mockResolvedValue(undefined);
    useAuthStore.setState({ user: ALICE, accessToken: 'tok' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('navigates to /login after logout', async () => {
    (authApi.logout as MockInstance).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('still clears auth and navigates even when authApi.logout throws', async () => {
    (authApi.logout as MockInstance).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------
describe('useAuth — register()', () => {
  it('calls authApi.register with the provided data', async () => {
    (authApi.register as MockInstance).mockResolvedValue({ id: 'new-user' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register({
        email: 'new@example.com',
        password: 'SecurePass1',
        full_name: 'New User',
      });
    });

    expect(authApi.register).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'SecurePass1',
      full_name: 'New User',
    });
  });

  it('navigates to /login after successful registration', async () => {
    (authApi.register as MockInstance).mockResolvedValue({ id: 'new-user' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register({
        email: 'new@example.com',
        password: 'SecurePass1',
        full_name: 'New User',
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('shows a success toast after registration', async () => {
    (authApi.register as MockInstance).mockResolvedValue({ id: 'new-user' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.register({
        email: 'new@example.com',
        password: 'SecurePass1',
        full_name: 'New User',
      });
    });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Account created'));
  });

  it('propagates errors from authApi.register', async () => {
    (authApi.register as MockInstance).mockRejectedValue(new Error('Email taken'));

    const { result } = renderHook(() => useAuth());

    await expect(
      act(async () => {
        await result.current.register({
          email: 'taken@example.com',
          password: 'SecurePass1',
          full_name: 'Dup User',
        });
      })
    ).rejects.toThrow('Email taken');

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Return values
// ---------------------------------------------------------------------------
describe('useAuth — return values', () => {
  it('isAuthenticated is true when accessToken is set', () => {
    useAuthStore.setState({ user: ALICE, accessToken: 'tok' });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('isAuthenticated is false when accessToken is null', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
  });
});
