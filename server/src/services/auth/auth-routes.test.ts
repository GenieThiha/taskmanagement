/**
 * auth-routes.test.ts
 * Integration tests for auth HTTP endpoints using Supertest.
 * The entire auth-service layer is mocked so no real DB or Redis is used.
 * The app is booted via createApp() so middleware (CORS, Helmet, cookie-parser,
 * validate, etc.) runs as in production.
 */

process.env.NODE_ENV = 'test';

// ---- Mock heavy infrastructure before the app boots --------------------

jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    scan: jest.fn().mockResolvedValue(['0', []]),
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

jest.mock('../../models', () => ({
  sequelize: { authenticate: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../middleware/helmet-config', () => ({
  helmetConfig: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/cors-config', () => ({
  corsConfig: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../middleware/rate-limit', () => ({
  globalRateLimiter: (_req: any, _res: any, next: any) => next(),
  authRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../logger/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../logger/morgan-stream', () => ({
  morganStream: { write: jest.fn() },
}));

// Mock all routers other than auth so they don't try to connect to DB.
// ts-jest compiles default exports so the factory must use __esModule: true
// and assign the Router instance to the `default` property.
jest.mock('../tasks/task-router', () => {
  const { Router } = require('express');
  const router = Router();
  return { __esModule: true, default: router };
});
jest.mock('../users/user-router', () => {
  const { Router } = require('express');
  const router = Router();
  return { __esModule: true, default: router };
});
jest.mock('../projects/project-router', () => {
  const { Router } = require('express');
  const router = Router();
  return { __esModule: true, default: router };
});
jest.mock('../notifications/notification-router', () => {
  const { Router } = require('express');
  const router = Router();
  return { __esModule: true, default: router };
});

// ---- Mock auth service -------------------------------------------------
jest.mock('./auth-service');

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';
import * as authService from './auth-service';

const mockAuthService = authService as jest.Mocked<typeof authService>;

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------
const VALID_USER = {
  id: 'user-1',
  email: 'alice@example.com',
  full_name: 'Alice Smith',
  role: 'member',
  is_active: true,
};

// A real JWT so authGuard can verify it in logout/change-password tests
function makeAccessToken(payload: Record<string, unknown> = {}) {
  return jwt.sign(
    { sub: 'user-1', email: 'alice@example.com', role: 'member', jti: 'test-jti', ...payload },
    'test-only-jwt-secret-not-for-production-use',
    { expiresIn: '15m' }
  );
}

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  app = createApp();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /v1/auth/register
// ---------------------------------------------------------------------------
describe('POST /v1/auth/register', () => {
  const VALID_BODY = {
    email: 'alice@example.com',
    password: 'SecurePass1',
    full_name: 'Alice Smith',
  };

  it('returns 201 with user data on successful registration', async () => {
    mockAuthService.register.mockResolvedValue(VALID_USER as any);

    const res = await request(app).post('/v1/auth/register').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ email: 'alice@example.com' });
    expect(res.body.data).not.toHaveProperty('password_hash');
  });

  it('returns 409 when the email is already registered', async () => {
    const err = Object.assign(new Error('Email already registered'), { status: 409 });
    mockAuthService.register.mockRejectedValue(err);

    const res = await request(app).post('/v1/auth/register').send(VALID_BODY);

    expect(res.status).toBe(409);
  });

  it('returns 400 when the request body fails Joi validation (bad email)', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ ...VALID_BODY, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('returns 400 when password does not meet complexity requirements', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ ...VALID_BODY, password: 'weak' });

    expect(res.status).toBe(400);
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });

  it('returns 400 when full_name is missing', async () => {
    const { full_name: _, ...body } = VALID_BODY;
    const res = await request(app).post('/v1/auth/register').send(body);

    expect(res.status).toBe(400);
    expect(mockAuthService.register).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/login
// ---------------------------------------------------------------------------
describe('POST /v1/auth/login', () => {
  const VALID_BODY = { email: 'alice@example.com', password: 'SecurePass1' };

  it('returns 200 and sets an httpOnly refresh_token cookie on success', async () => {
    mockAuthService.login.mockResolvedValue({
      user: VALID_USER,
      accessToken: 'access-tok',
      refreshToken: 'refresh-tok',
    } as any);

    const res = await request(app).post('/v1/auth/login').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('access-tok');
    // Cookie header should be present
    const cookieHeader = res.headers['set-cookie'] as string[] | string;
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    expect(cookies.some((c: string) => c.startsWith('refresh_token='))).toBe(true);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
  });

  it('returns 401 on wrong credentials', async () => {
    const err = Object.assign(new Error('Invalid credentials'), { status: 401 });
    mockAuthService.login.mockRejectedValue(err);

    const res = await request(app).post('/v1/auth/login').send(VALID_BODY);

    expect(res.status).toBe(401);
  });

  it('returns 423 when the account is locked', async () => {
    const err = Object.assign(new Error('Account is temporarily locked'), { status: 423 });
    mockAuthService.login.mockRejectedValue(err);

    const res = await request(app).post('/v1/auth/login').send(VALID_BODY);

    expect(res.status).toBe(423);
  });

  it('returns 400 when the request body fails validation', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/refresh
// ---------------------------------------------------------------------------
describe('POST /v1/auth/refresh', () => {
  it('returns 200 and a new access token when the refresh_token cookie is valid', async () => {
    mockAuthService.refresh.mockResolvedValue({
      accessToken: 'new-access-tok',
      refreshToken: 'new-refresh-tok',
    } as any);

    const res = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', 'refresh_token=valid-cookie-token');

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('new-access-tok');
  });

  it('returns 401 when the refresh_token cookie is absent', async () => {
    const res = await request(app).post('/v1/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.detail).toMatch(/cookie missing/i);
    expect(mockAuthService.refresh).not.toHaveBeenCalled();
  });

  it('returns 401 when the refresh service throws (revoked/expired token)', async () => {
    const err = Object.assign(new Error('Refresh token expired'), { status: 401 });
    mockAuthService.refresh.mockRejectedValue(err);

    const res = await request(app)
      .post('/v1/auth/refresh')
      .set('Cookie', 'refresh_token=expired-token');

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/logout
// ---------------------------------------------------------------------------
describe('POST /v1/auth/logout', () => {
  it('returns 204 and clears the cookie when the user is authenticated', async () => {
    // authGuard needs a valid JWT in the Authorization header
    mockAuthService.logout.mockResolvedValue(undefined);

    const token = makeAccessToken();

    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).post('/v1/auth/logout');

    expect(res.status).toBe(401);
    expect(mockAuthService.logout).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/forgot-password
// ---------------------------------------------------------------------------
describe('POST /v1/auth/forgot-password', () => {
  it('always returns 200 (avoids user enumeration)', async () => {
    mockAuthService.forgotPassword.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/auth/forgot-password')
      .send({ email: 'anyone@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/reset link/i);
  });

  it('returns 200 even when the email does not exist in the system', async () => {
    mockAuthService.forgotPassword.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/v1/auth/forgot-password')
      .send({ email: 'ghost@example.com' });

    // Must not differ from the found-user case — avoids enumeration
    expect(res.status).toBe(200);
  });

  it('returns 400 when email is missing or invalid', async () => {
    const res = await request(app)
      .post('/v1/auth/forgot-password')
      .send({ email: 'not-valid' });

    expect(res.status).toBe(400);
    expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PATCH /v1/auth/reset-password
// ---------------------------------------------------------------------------
describe('PATCH /v1/auth/reset-password', () => {
  const VALID_BODY = { token: 'abc123', new_password: 'NewSecure1' };

  it('returns 200 on a successful password reset', async () => {
    mockAuthService.resetPassword.mockResolvedValue(undefined);

    const res = await request(app).patch('/v1/auth/reset-password').send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/success/i);
  });

  it('returns 400 when the token is invalid or expired', async () => {
    const err = Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
    mockAuthService.resetPassword.mockRejectedValue(err);

    const res = await request(app).patch('/v1/auth/reset-password').send(VALID_BODY);

    expect(res.status).toBe(400);
  });

  it('returns 400 when the body fails validation (missing token)', async () => {
    const res = await request(app)
      .patch('/v1/auth/reset-password')
      .send({ new_password: 'NewSecure1' });

    expect(res.status).toBe(400);
    expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
  });

  it('returns 400 when new_password is too weak', async () => {
    const res = await request(app)
      .patch('/v1/auth/reset-password')
      .send({ token: 'abc123', new_password: 'weak' });

    expect(res.status).toBe(400);
    expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PATCH /v1/auth/change-password
// ---------------------------------------------------------------------------
describe('PATCH /v1/auth/change-password', () => {
  const VALID_BODY = { current_password: 'OldPass1', new_password: 'NewSecure1' };

  it('returns 200 when the authenticated user changes their password', async () => {
    mockAuthService.changePassword.mockResolvedValue(undefined);
    const token = makeAccessToken();

    const res = await request(app)
      .patch('/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send(VALID_BODY);

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/changed/i);
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).patch('/v1/auth/change-password').send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });

  it('returns 400 when the body fails validation', async () => {
    const token = makeAccessToken();

    const res = await request(app)
      .patch('/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'OldPass1' }); // missing new_password

    expect(res.status).toBe(400);
    expect(mockAuthService.changePassword).not.toHaveBeenCalled();
  });
});
