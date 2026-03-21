/**
 * require-role.test.ts
 * Unit tests for the requireRole middleware factory.
 * No external dependencies — purely exercises the role-hierarchy logic.
 */

process.env.NODE_ENV = 'test';

import { Request, Response, NextFunction } from 'express';
import { requireRole } from './require-role';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRes() {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as jest.Mocked<Response>;
}

function makeReqWithRole(role?: string): Partial<Request> {
  return role
    ? { user: { sub: 'u1', email: 'e@e.com', role, jti: 'j', exp: 9999 } as any }
    : {};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('requireRole middleware', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn();
  });

  // ---- missing user ---------------------------------------------------
  it('returns 401 when req.user is not set', () => {
    const mw = requireRole('member');
    const res = makeRes();
    mw(makeReqWithRole() as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 401, detail: 'Authentication required' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ---- member attempting manager-only route ---------------------------
  it('returns 403 when a member tries a manager-only route', () => {
    const mw = requireRole('manager');
    const res = makeRes();
    mw(makeReqWithRole('member') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 })
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ---- member attempting admin-only route -----------------------------
  it('returns 403 when a member tries an admin-only route', () => {
    const mw = requireRole('admin');
    const res = makeRes();
    mw(makeReqWithRole('member') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ---- manager attempting admin-only route ----------------------------
  it('returns 403 when a manager tries an admin-only route', () => {
    const mw = requireRole('admin');
    const res = makeRes();
    mw(makeReqWithRole('manager') as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ---- admin satisfies manager requirement (hierarchy) ----------------
  it('calls next() when admin accesses a manager-required route', () => {
    const mw = requireRole('manager');
    const res = makeRes();
    mw(makeReqWithRole('admin') as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  // ---- admin satisfies member requirement -----------------------------
  it('calls next() when admin accesses a member-required route', () => {
    const mw = requireRole('member');
    const res = makeRes();
    mw(makeReqWithRole('admin') as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  // ---- exact role match -----------------------------------------------
  it('calls next() when the user role exactly matches the required role', () => {
    const mw = requireRole('manager');
    const res = makeRes();
    mw(makeReqWithRole('manager') as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when member accesses a member-required route', () => {
    const mw = requireRole('member');
    const res = makeRes();
    mw(makeReqWithRole('member') as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  // ---- multi-role acceptance ------------------------------------------
  it('accepts a user whose role satisfies at least one of the required roles', () => {
    // Route requires manager OR admin; manager should pass.
    const mw = requireRole('manager', 'admin');
    const res = makeRes();
    mw(makeReqWithRole('manager') as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('includes required roles in the 403 error detail', () => {
    const mw = requireRole('admin', 'manager');
    const res = makeRes();
    mw(makeReqWithRole('member') as Request, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('admin'),
      })
    );
  });
});
