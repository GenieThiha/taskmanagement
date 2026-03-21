/**
 * axios-instance.test.ts
 * Tests for the Axios instance request/response interceptors.
 *
 * We test the interceptor logic by directly invoking the interceptor handlers
 * extracted from the apiClient's internal interceptor stack. This avoids
 * spinning up an HTTP server while still exercising the real interceptor code.
 *
 * Note: the module has module-level state (isRefreshing, failedQueue) so we
 * use vi.resetModules() + dynamic import in tests that exercise the refresh
 * flow, ensuring each test gets a clean interceptor state.
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../modules/auth/auth-store';

// Stub window.location for the entire file so the interceptor's
// `window.location.href = '/login'` does not trigger jsdom's unhandled
// "Not implemented: navigation" error.
let originalLocation: Location;
beforeAll(() => {
  originalLocation = window.location;
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: { ...window.location, href: '' },
  });
});
afterAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    configurable: true,
    value: originalLocation,
  });
});

// ---------------------------------------------------------------------------
// Mocks declared at module scope so they are hoisted correctly by Vitest
// ---------------------------------------------------------------------------

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(),
      create: actual.default.create.bind(actual.default),
      isAxiosError: actual.default.isAxiosError.bind(actual.default),
    },
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(extra: Record<string, unknown> = {}): InternalAxiosRequestConfig {
  return { headers: {} as any, url: '/test', method: 'get', ...extra } as any;
}

function makeAxiosError(status: number, data: unknown = {}): AxiosError {
  const err = new Error(`HTTP ${status}`) as AxiosError;
  err.isAxiosError = true;
  err.config = makeConfig();
  err.response = {
    status,
    data,
    headers: {},
    config: err.config,
    statusText: String(status),
  } as AxiosResponse;
  return err;
}

function makeSuccessResponse(data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    headers: {},
    config: makeConfig(),
    statusText: 'OK',
  } as AxiosResponse;
}

// Retrieve the interceptor handlers from a (freshly imported) apiClient
async function getInterceptors() {
  const { apiClient } = await import('./axios-instance');
  const reqHandlers = (apiClient.interceptors.request as any).handlers;
  const resHandlers = (apiClient.interceptors.response as any).handlers;
  const reqFulfilled = reqHandlers[reqHandlers.length - 1]?.fulfilled;
  const resFulfilled = resHandlers[resHandlers.length - 1]?.fulfilled;
  const resRejected = resHandlers[resHandlers.length - 1]?.rejected;
  return { apiClient, reqFulfilled, resFulfilled, resRejected };
}

// ---------------------------------------------------------------------------
// Store reset
// ---------------------------------------------------------------------------
beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Request interceptor: Bearer token injection
// ---------------------------------------------------------------------------
describe('request interceptor — Bearer token', () => {
  it('attaches Authorization header when an accessToken is in the store', async () => {
    useAuthStore.setState({ user: null, accessToken: 'my-access-token' });
    const { reqFulfilled } = await getInterceptors();

    const result = await reqFulfilled(makeConfig());

    expect(result.headers.Authorization).toBe('Bearer my-access-token');
  });

  it('does not set Authorization header when no token is in the store', async () => {
    useAuthStore.setState({ user: null, accessToken: null });
    const { reqFulfilled } = await getInterceptors();

    const result = await reqFulfilled(makeConfig());

    expect(result.headers.Authorization).toBeUndefined();
  });

  it('passes the config through unchanged (no mutation of other fields)', async () => {
    useAuthStore.setState({ user: null, accessToken: null });
    const { reqFulfilled } = await getInterceptors();
    const config = makeConfig({ url: '/specific-path', method: 'post' });

    const result = await reqFulfilled(config);

    expect(result.url).toBe('/specific-path');
    expect(result.method).toBe('post');
  });
});

// ---------------------------------------------------------------------------
// Response interceptor: successful pass-through
// ---------------------------------------------------------------------------
describe('response interceptor — successful responses', () => {
  it('returns 2xx responses unchanged via the fulfilled handler', async () => {
    const { resFulfilled } = await getInterceptors();
    const response = makeSuccessResponse({ hello: 'world' });

    const result = await resFulfilled(response);

    expect(result).toBe(response);
  });

  it('does not modify response data on success', async () => {
    const { resFulfilled } = await getInterceptors();
    const response = makeSuccessResponse({ sensitive: 'data' });

    const result = await resFulfilled(response);

    expect(result.data).toEqual({ sensitive: 'data' });
  });
});

// ---------------------------------------------------------------------------
// Response interceptor: error sanitisation
// ---------------------------------------------------------------------------
describe('response interceptor — error sanitisation', () => {
  it('replaces 5xx response data.detail with a generic message', async () => {
    const { resRejected } = await getInterceptors();
    const error = makeAxiosError(500, { detail: 'Internal stack trace here' });
    // Mark as already retried so the 401 refresh branch is not triggered
    (error.config as any)._retry = true;

    await expect(resRejected(error)).rejects.toMatchObject({
      response: {
        data: { detail: expect.stringContaining('server error') },
      },
    });
  });

  it('replaces 503 data with a generic message', async () => {
    const { resRejected } = await getInterceptors();
    const error = makeAxiosError(503, { detail: 'DB connection pool exhausted' });
    (error.config as any)._retry = true;

    await expect(resRejected(error)).rejects.toMatchObject({
      response: { data: { detail: expect.stringContaining('server error') } },
    });
  });

  it('preserves the original detail on a 403 (client error, not sanitised)', async () => {
    const { resRejected } = await getInterceptors();
    const error = makeAxiosError(403, { detail: 'Forbidden' });
    (error.config as any)._retry = true;

    await expect(resRejected(error)).rejects.toMatchObject({
      response: { data: { detail: 'Forbidden' } },
    });
  });

  it('preserves the original detail on a 404 error', async () => {
    const { resRejected } = await getInterceptors();
    const error = makeAxiosError(404, { detail: 'Task not found' });
    (error.config as any)._retry = true;

    await expect(resRejected(error)).rejects.toMatchObject({
      response: { data: { detail: 'Task not found' } },
    });
  });

  it('passes non-Axios errors through unchanged', async () => {
    const { resRejected } = await getInterceptors();
    const plainError = new Error('Network failure');

    await expect(resRejected(plainError)).rejects.toThrow('Network failure');
  });
});

// ---------------------------------------------------------------------------
// Response interceptor: 401 → refresh flow
//
// The axios-instance module keeps module-level state (isRefreshing, failedQueue).
// Because Vitest caches modules within a file, all tests that invoke the
// refresh code path share one isRefreshing flag. The strategy below ensures
// each 401 scenario is independent:
//
//   • Tests that don't enter the refresh branch (_retry=true, non-401) are
//     unaffected by module state and run as normal.
//   • Tests that DO enter the refresh branch are written so they fully resolve
//     (isRefreshing returns to false) before the next test checks state.
//     They are placed in a single describe so execution order is guaranteed.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// bypass cases (no window.location interaction, no module-state concerns)
// ---------------------------------------------------------------------------
describe('response interceptor — 401 refresh flow: bypass cases', () => {
  it('does NOT attempt a refresh when the request already has _retry=true', async () => {
    const { resRejected } = await getInterceptors();
    const axiosMod = await import('axios');
    const axiosPost = axiosMod.default.post as ReturnType<typeof vi.fn>;

    const error = makeAxiosError(401);
    (error.config as any)._retry = true;

    await expect(resRejected(error)).rejects.toBeDefined();

    expect(axiosPost).not.toHaveBeenCalled();
  });

  it('does not trigger the 401 refresh flow for non-401 errors (422)', async () => {
    const { resRejected } = await getInterceptors();
    const axiosMod = await import('axios');
    const axiosPost = axiosMod.default.post as ReturnType<typeof vi.fn>;

    const error = makeAxiosError(422, { detail: 'Unprocessable Entity' });
    (error.config as any)._retry = true;

    await expect(resRejected(error)).rejects.toBeDefined();

    expect(axiosPost).not.toHaveBeenCalled();
  });
});

// The two tests below enter the refresh branch and are run in a single
// describe so they execute sequentially on the shared module state.
// Each test fully awaits the refresh flow so isRefreshing resets to false
// before the next one starts.
describe('response interceptor — 401 refresh flow: active refresh', () => {
  it('calls axios.post for refresh and updates the store with the new token', async () => {
    // This test verifies the two key side-effects of a successful refresh:
    //   1. axios.post is called with the /auth/refresh URL
    //   2. the store is updated with the new access token
    //
    // We allow the subsequent apiClient(originalRequest) retry to reject
    // (since the retry target doesn't exist in jsdom) and simply ignore that
    // rejection — it's outside the scope of what this test covers.
    useAuthStore.setState({ user: null, accessToken: 'old-token' });

    const axiosMod = await import('axios');
    const axiosPost = axiosMod.default.post as ReturnType<typeof vi.fn>;
    axiosPost.mockResolvedValueOnce({
      data: { data: { accessToken: 'refreshed-token' } },
    });

    const { resRejected } = await getInterceptors();

    // Catch the rejection from the retry network call — it's expected
    await resRejected(makeAxiosError(401)).catch(() => { /* retry network fail is expected */ });

    expect(axiosPost).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      {},
      expect.objectContaining({ withCredentials: true })
    );
    expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
  });

  it('clears auth state when the refresh call itself fails', async () => {
    const user = {
      id: 'u1', email: 'a@b.com', full_name: 'A',
      role: 'member' as const, is_active: true,
    };
    useAuthStore.setState({ user, accessToken: 'stale-token' });

    const axiosMod = await import('axios');
    (axiosMod.default.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Refresh failed')
    );

    const { resRejected } = await getInterceptors();

    let threw = false;
    try {
      await resRejected(makeAxiosError(401));
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
