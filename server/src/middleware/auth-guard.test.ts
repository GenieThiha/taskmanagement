/**
 * auth-guard.test.ts
 * Unit tests for the authGuard middleware.
 * All external dependencies (jwt, redisClient) are mocked so no
 * real network calls or processes are started.
 */

process.env.NODE_ENV = 'test';

// Mock redis before it is imported by auth-guard
jest.mock('../config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
  },
}));

jest.mock('jsonwebtoken');

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { redisClient } from '../config/redis';
import { authGuard } from './auth-guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function makeRes() {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as jest.Mocked<Response>;
}

const validPayload = {
  sub: 'user-1',
  email: 'alice@example.com',
  role: 'member',
  jti: 'jti-abc',
  exp: Math.floor(Date.now() / 1000) + 900,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('authGuard middleware', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeReq();
    const res = makeRes();

    await authGuard(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, detail: 'Missing or invalid Authorization header' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not use Bearer scheme', async () => {
    const req = makeReq('Basic dXNlcjpwYXNz');
    const res = makeRes();

    await authGuard(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the JWT is invalid', async () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const req = makeReq('Bearer bad.token.here');
    const res = makeRes();

    await authGuard(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Invalid or expired token' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the JWT is expired', async () => {
    mockJwt.verify.mockImplementation(() => {
      const err = new Error('jwt expired');
      (err as any).name = 'TokenExpiredError';
      throw err;
    });

    const req = makeReq('Bearer expired.token');
    const res = makeRes();

    await authGuard(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the token jti is in the Redis blocklist', async () => {
    mockJwt.verify.mockReturnValue(validPayload as any);
    mockRedis.get.mockResolvedValue('1'); // blocklisted

    const req = makeReq('Bearer valid.but.blocked');
    const res = makeRes();

    await authGuard(req as Request, res, next);

    expect(mockRedis.get).toHaveBeenCalledWith(`blocklist:${validPayload.jti}`);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Token has been invalidated' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and sets req.user when token is valid and not blocked', async () => {
    mockJwt.verify.mockReturnValue(validPayload as any);
    mockRedis.get.mockResolvedValue(null); // not blocked

    const req = makeReq('Bearer valid.token.here') as Request;
    const res = makeRes();

    await authGuard(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual(validPayload);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('checks the blocklist key using the correct jti prefix', async () => {
    mockJwt.verify.mockReturnValue(validPayload as any);
    mockRedis.get.mockResolvedValue(null);

    const req = makeReq('Bearer valid.token') as Request;
    await authGuard(req, makeRes(), next);

    expect(mockRedis.get).toHaveBeenCalledWith('blocklist:jti-abc');
  });
});
