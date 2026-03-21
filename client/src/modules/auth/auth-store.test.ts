/**
 * auth-store.test.ts
 * Unit tests for the Zustand auth store.
 * Validates state mutations, persistence partialise rules, and localStorage behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, AuthUser } from './auth-store';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const ALICE: AuthUser = {
  id: 'user-1',
  email: 'alice@example.com',
  full_name: 'Alice Smith',
  role: 'member',
  is_active: true,
};

const BOB: AuthUser = {
  id: 'user-2',
  email: 'bob@example.com',
  full_name: 'Bob Jones',
  role: 'manager',
  is_active: true,
};

// Reset store and localStorage before each test
beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
describe('initial state', () => {
  it('starts with user set to null', () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('starts with accessToken set to null', () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setAuth()
// ---------------------------------------------------------------------------
describe('setAuth()', () => {
  it('sets both user and accessToken', () => {
    useAuthStore.getState().setAuth(ALICE, 'tok-abc');

    const { user, accessToken } = useAuthStore.getState();
    expect(user).toEqual(ALICE);
    expect(accessToken).toBe('tok-abc');
  });

  it('overwrites a previously stored user', () => {
    useAuthStore.getState().setAuth(ALICE, 'tok-1');
    useAuthStore.getState().setAuth(BOB, 'tok-2');

    expect(useAuthStore.getState().user).toEqual(BOB);
    expect(useAuthStore.getState().accessToken).toBe('tok-2');
  });

  it('accepts any string token including a real JWT-shaped string', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig';
    useAuthStore.getState().setAuth(ALICE, jwt);
    expect(useAuthStore.getState().accessToken).toBe(jwt);
  });
});

// ---------------------------------------------------------------------------
// clearAuth()
// ---------------------------------------------------------------------------
describe('clearAuth()', () => {
  it('sets user to null', () => {
    useAuthStore.getState().setAuth(ALICE, 'tok-abc');
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('sets accessToken to null', () => {
    useAuthStore.getState().setAuth(ALICE, 'tok-abc');
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('is a no-op when the store is already cleared', () => {
    // Should not throw
    expect(() => useAuthStore.getState().clearAuth()).not.toThrow();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setAccessToken()
// ---------------------------------------------------------------------------
describe('setAccessToken()', () => {
  it('updates only accessToken without touching user', () => {
    useAuthStore.getState().setAuth(ALICE, 'old-token');
    useAuthStore.getState().setAccessToken('new-token');

    expect(useAuthStore.getState().user).toEqual(ALICE); // unchanged
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('can be called before setAuth to pre-set a token', () => {
    useAuthStore.getState().setAccessToken('pre-token');
    expect(useAuthStore.getState().accessToken).toBe('pre-token');
    expect(useAuthStore.getState().user).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Persistence (localStorage / partialize)
// ---------------------------------------------------------------------------
describe('persistence', () => {
  it('writes the user object to localStorage under the tma-auth key', () => {
    useAuthStore.getState().setAuth(ALICE, 'tok-abc');

    const stored = JSON.parse(localStorage.getItem('tma-auth') ?? '{}');
    expect(stored.state.user).toMatchObject({ id: 'user-1', email: 'alice@example.com' });
  });

  it('does NOT persist accessToken to localStorage (XSS risk)', () => {
    useAuthStore.getState().setAuth(ALICE, 'secret-token');

    const raw = localStorage.getItem('tma-auth') ?? '{}';
    // The raw string must not contain the token value in any form.
    expect(raw).not.toContain('secret-token');
    const stored = JSON.parse(raw);
    expect(stored.state?.accessToken).toBeUndefined();
  });

  it('persists user null after clearAuth', () => {
    useAuthStore.getState().setAuth(ALICE, 'tok-abc');
    useAuthStore.getState().clearAuth();

    const stored = JSON.parse(localStorage.getItem('tma-auth') ?? '{}');
    expect(stored.state.user).toBeNull();
  });
});
