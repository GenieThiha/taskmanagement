/**
 * protected-route.test.tsx
 * Component tests for ProtectedRoute.
 * react-router-dom is mocked so no BrowserRouter is needed and navigation
 * assertions are clean. The auth store is manipulated directly per test.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { useAuthStore } from '../modules/auth/auth-store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockNavigateTo = vi.fn();

vi.mock('react-router-dom', () => ({
  Navigate: ({ to, state, replace }: { to: string; state?: unknown; replace?: boolean }) => {
    // Render a div so we can assert where Navigate was told to go
    return (
      <div
        data-testid="navigate"
        data-to={to}
        data-state={JSON.stringify(state)}
        data-replace={String(replace)}
      />
    );
  },
  useLocation: () => ({ pathname: '/protected-page', search: '', hash: '', state: null }),
}));

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/** Build a minimal base64url-encoded JWT payload with an exp claim. */
function makeToken(expOffsetSeconds: number): string {
  const payload = { sub: 'user-1', exp: Math.floor(Date.now() / 1000) + expOffsetSeconds };
  const encoded = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `header.${encoded}.signature`;
}

const VALID_TOKEN = makeToken(900); // expires in 15 min
const EXPIRED_TOKEN = makeToken(-60); // expired 1 minute ago

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALICE_MEMBER = {
  id: 'user-1',
  email: 'alice@example.com',
  full_name: 'Alice Smith',
  role: 'member' as const,
  is_active: true,
};

const BOB_MANAGER = {
  id: 'user-2',
  email: 'bob@example.com',
  full_name: 'Bob Jones',
  role: 'manager' as const,
  is_active: true,
};

const CAROL_ADMIN = {
  id: 'user-3',
  email: 'carol@example.com',
  full_name: 'Carol Chen',
  role: 'admin' as const,
  is_active: true,
};

// ---------------------------------------------------------------------------
// Import component AFTER mocks are set up
// ---------------------------------------------------------------------------
import { ProtectedRoute } from './protected-route';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
  vi.clearAllMocks();
});

function renderRoute(children: React.ReactNode = <div>Protected Content</div>, requiredRole?: 'admin' | 'manager' | 'member') {
  return render(
    <ProtectedRoute requiredRole={requiredRole}>{children}</ProtectedRoute>
  );
}

// ---------------------------------------------------------------------------
// No token
// ---------------------------------------------------------------------------
describe('ProtectedRoute — no accessToken', () => {
  it('renders Navigate to /login when there is no access token', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    renderRoute();

    const nav = screen.getByTestId('navigate');
    expect(nav).toBeInTheDocument();
    expect(nav.getAttribute('data-to')).toBe('/login');
  });

  it('passes the current location as state.from so the user can be redirected back', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    renderRoute();

    const nav = screen.getByTestId('navigate');
    const state = JSON.parse(nav.getAttribute('data-state') ?? '{}');
    expect(state.from).toBeDefined();
    expect(state.from.pathname).toBe('/protected-page');
  });

  it('does not render child content when unauthenticated', () => {
    useAuthStore.setState({ user: null, accessToken: null });

    renderRoute(<div>Protected Content</div>);

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Expired token
// ---------------------------------------------------------------------------
describe('ProtectedRoute — expired accessToken', () => {
  it('redirects to /login when the token is expired (exp in the past)', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: EXPIRED_TOKEN });

    renderRoute();

    const nav = screen.getByTestId('navigate');
    expect(nav.getAttribute('data-to')).toBe('/login');
  });

  it('does not render child content for an expired token', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: EXPIRED_TOKEN });

    renderRoute(<div>Secret</div>);

    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('treats a malformed token as expired (fail-closed)', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: 'not.a.jwt' });

    renderRoute();

    const nav = screen.getByTestId('navigate');
    expect(nav.getAttribute('data-to')).toBe('/login');
  });
});

// ---------------------------------------------------------------------------
// Valid token — no role requirement
// ---------------------------------------------------------------------------
describe('ProtectedRoute — valid token, no role requirement', () => {
  it('renders child content when the token is valid and no role is required', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: VALID_TOKEN });

    renderRoute(<div>Protected Content</div>);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('does not render a Navigate element for an authenticated user without role restriction', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: VALID_TOKEN });

    renderRoute();

    expect(screen.queryByTestId('navigate')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Valid token — role check
// ---------------------------------------------------------------------------
describe('ProtectedRoute — role-based access control', () => {
  it('redirects a member to /dashboard when an admin role is required', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: VALID_TOKEN });

    renderRoute(<div>Admin Area</div>, 'admin');

    const nav = screen.getByTestId('navigate');
    expect(nav.getAttribute('data-to')).toBe('/dashboard');
    expect(screen.queryByText('Admin Area')).not.toBeInTheDocument();
  });

  it('redirects a member to /dashboard when a manager role is required', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: VALID_TOKEN });

    renderRoute(<div>Manager Area</div>, 'manager');

    const nav = screen.getByTestId('navigate');
    expect(nav.getAttribute('data-to')).toBe('/dashboard');
  });

  it('allows a manager to access a manager-required route', () => {
    useAuthStore.setState({ user: BOB_MANAGER, accessToken: VALID_TOKEN });

    renderRoute(<div>Manager Area</div>, 'manager');

    expect(screen.getByText('Manager Area')).toBeInTheDocument();
  });

  it('allows an admin to access a manager-required route (hierarchy)', () => {
    useAuthStore.setState({ user: CAROL_ADMIN, accessToken: VALID_TOKEN });

    renderRoute(<div>Manager Area</div>, 'manager');

    expect(screen.getByText('Manager Area')).toBeInTheDocument();
  });

  it('allows an admin to access an admin-required route', () => {
    useAuthStore.setState({ user: CAROL_ADMIN, accessToken: VALID_TOKEN });

    renderRoute(<div>Admin Area</div>, 'admin');

    expect(screen.getByText('Admin Area')).toBeInTheDocument();
  });

  it('allows a member to access a member-required route', () => {
    useAuthStore.setState({ user: ALICE_MEMBER, accessToken: VALID_TOKEN });

    renderRoute(<div>Member Area</div>, 'member');

    expect(screen.getByText('Member Area')).toBeInTheDocument();
  });

  it('redirects a manager who tries to access an admin-required route', () => {
    useAuthStore.setState({ user: BOB_MANAGER, accessToken: VALID_TOKEN });

    renderRoute(<div>Admin Only</div>, 'admin');

    const nav = screen.getByTestId('navigate');
    expect(nav.getAttribute('data-to')).toBe('/dashboard');
    expect(screen.queryByText('Admin Only')).not.toBeInTheDocument();
  });

  it('renders children when token is valid and requiredRole is not specified', () => {
    useAuthStore.setState({ user: BOB_MANAGER, accessToken: VALID_TOKEN });

    renderRoute(<span>Open to all authenticated users</span>, undefined);

    expect(screen.getByText('Open to all authenticated users')).toBeInTheDocument();
  });
});
