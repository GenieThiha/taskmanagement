/**
 * auth-service.test.ts
 * Unit tests for the auth-service functions.
 * All external I/O (User model, redisClient, bcrypt, jwt, mailer) is mocked.
 */

process.env.NODE_ENV = 'test';

// ---- Mock: redis --------------------------------------------------------
jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    scan: jest.fn(),
  },
}));

// ---- Mock: User model ---------------------------------------------------
jest.mock('../../models/user.model', () => ({
  User: {
    unscoped: jest.fn(),
    scope: jest.fn(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

// ---- Mock: mailer -------------------------------------------------------
jest.mock('../../config/mailer', () => ({
  mailer: { sendMail: jest.fn().mockResolvedValue(undefined) },
}));

// ---- Mock: logger -------------------------------------------------------
jest.mock('../../logger/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---- Mock: bcrypt -------------------------------------------------------
jest.mock('bcrypt');

// ---- Mock: jsonwebtoken -------------------------------------------------
jest.mock('jsonwebtoken');

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../../models/user.model';
import { redisClient } from '../../config/redis';
import { mailer } from '../../config/mailer';
import * as authService from './auth-service';

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------
const mockRedis = redisClient as jest.Mocked<typeof redisClient>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockMailer = mailer as jest.Mocked<typeof mailer>;

const MockUser = User as jest.Mocked<typeof User>;

// Minimal user factory
function makeUser(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'user-1',
    email: 'alice@example.com',
    password_hash: 'hashed-pw',
    full_name: 'Alice Smith',
    role: 'member',
    is_active: true,
    failed_login_attempts: 0,
    locked_until: null,
    toJSON: jest.fn().mockReturnValue({
      id: 'user-1',
      email: 'alice@example.com',
      password_hash: 'hashed-pw',
      full_name: 'Alice Smith',
      role: 'member',
      is_active: true,
      failed_login_attempts: 0,
      locked_until: null,
    }),
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return base;
}

// Reset all mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------
describe('authService.register', () => {
  const payload = { email: 'alice@example.com', password: 'Secure1!', full_name: 'Alice Smith' };

  it('creates and returns a new user without password_hash', async () => {
    const unscopedMock = { findOne: jest.fn().mockResolvedValue(null) };
    MockUser.unscoped.mockReturnValue(unscopedMock as any);

    const createdUser = makeUser();
    MockUser.create.mockResolvedValue(createdUser as any);
    (mockBcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');

    const result = await authService.register(payload);

    expect(unscopedMock.findOne).toHaveBeenCalledWith({ where: { email: payload.email } });
    expect(MockUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: payload.email, role: 'member' })
    );
    expect(result).not.toHaveProperty('password_hash');
    expect(result.email).toBe('alice@example.com');
  });

  it('throws 409 when the email is already registered', async () => {
    const unscopedMock = { findOne: jest.fn().mockResolvedValue(makeUser()) };
    MockUser.unscoped.mockReturnValue(unscopedMock as any);

    await expect(authService.register(payload)).rejects.toMatchObject({
      message: 'Email already registered',
      status: 409,
    });
    expect(MockUser.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------
describe('authService.login', () => {
  function setupLogin(userOverrides: Record<string, unknown> = {}) {
    const user = makeUser(userOverrides);
    const scopedMock = { findOne: jest.fn().mockResolvedValue(user) };
    MockUser.scope.mockReturnValue(scopedMock as any);
    return { user, scopedMock };
  }

  beforeEach(() => {
    // Default: jwt.sign returns predictable strings; jwt.decode returns a jti
    (mockJwt.sign as jest.Mock).mockReturnValue('signed-token');
    (mockJwt.decode as jest.Mock).mockReturnValue({ jti: 'refresh-jti-1', sub: 'user-1' });
    mockRedis.set.mockResolvedValue('OK' as any);
  });

  it('returns user (without password_hash) + token pair on success', async () => {
    const { user } = setupLogin();
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await authService.login('alice@example.com', 'Secure1!');

    expect(user.update).toHaveBeenCalledWith({ failed_login_attempts: 0, locked_until: null });
    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
  });

  it('stores the refresh token jti in Redis with 7-day TTL', async () => {
    setupLogin();
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    await authService.login('alice@example.com', 'Secure1!');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'refresh:user-1:refresh-jti-1',
      '1',
      'EX',
      7 * 24 * 60 * 60
    );
  });

  it('throws 401 when no user is found with that email', async () => {
    const scopedMock = { findOne: jest.fn().mockResolvedValue(null) };
    MockUser.scope.mockReturnValue(scopedMock as any);

    await expect(authService.login('unknown@example.com', 'Secure1!')).rejects.toMatchObject({
      message: 'Invalid credentials',
      status: 401,
    });
  });

  it('throws 401 when the account is inactive', async () => {
    setupLogin({ is_active: false });

    await expect(authService.login('alice@example.com', 'Secure1!')).rejects.toMatchObject({
      message: 'Account is inactive',
      status: 401,
    });
  });

  it('throws 423 when the account is locked', async () => {
    setupLogin({ locked_until: new Date(Date.now() + 60_000) });

    await expect(authService.login('alice@example.com', 'Secure1!')).rejects.toMatchObject({
      status: 423,
    });
  });

  it('throws 401 on wrong password and increments failed_login_attempts', async () => {
    const { user } = setupLogin({ failed_login_attempts: 0 });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(authService.login('alice@example.com', 'wrong')).rejects.toMatchObject({
      status: 401,
    });

    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({ failed_login_attempts: 1 })
    );
  });

  it('locks the account after 5 consecutive failed logins', async () => {
    const { user } = setupLogin({ failed_login_attempts: 4 });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(authService.login('alice@example.com', 'wrong')).rejects.toMatchObject({
      status: 401,
    });

    // 5th failure — locked_until should be set
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        failed_login_attempts: 5,
        locked_until: expect.any(Date),
      })
    );
  });

  it('resets failed_login_attempts to 0 on successful login', async () => {
    const { user } = setupLogin({ failed_login_attempts: 3 });
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    await authService.login('alice@example.com', 'Secure1!');

    expect(user.update).toHaveBeenCalledWith({ failed_login_attempts: 0, locked_until: null });
  });
});

// ---------------------------------------------------------------------------
// refresh()
// ---------------------------------------------------------------------------
describe('authService.refresh', () => {
  const VALID_REFRESH_TOKEN = 'valid-refresh-token';

  beforeEach(() => {
    (mockJwt.verify as jest.Mock).mockReturnValue({ sub: 'user-1', jti: 'old-jti' });
    (mockJwt.sign as jest.Mock).mockReturnValue('new-signed-token');
    (mockJwt.decode as jest.Mock).mockReturnValue({ jti: 'new-jti', sub: 'user-1' });
    mockRedis.get.mockResolvedValue('1');
    mockRedis.del.mockResolvedValue(1 as any);
    mockRedis.set.mockResolvedValue('OK' as any);
    MockUser.findByPk.mockResolvedValue(makeUser() as any);
  });

  it('returns a new token pair on a valid refresh token', async () => {
    const tokens = await authService.refresh(VALID_REFRESH_TOKEN);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
  });

  it('deletes the old refresh key and stores the new one (rotation)', async () => {
    await authService.refresh(VALID_REFRESH_TOKEN);

    expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-1:old-jti');
    expect(mockRedis.set).toHaveBeenCalledWith(
      'refresh:user-1:new-jti',
      '1',
      'EX',
      expect.any(Number)
    );
  });

  it('throws 401 when the refresh token JWT is invalid', async () => {
    (mockJwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(authService.refresh('bad-token')).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when the refresh key is not found in Redis (expired or revoked)', async () => {
    mockRedis.get.mockResolvedValue(null);

    await expect(authService.refresh(VALID_REFRESH_TOKEN)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when the user no longer exists', async () => {
    MockUser.findByPk.mockResolvedValue(null);

    await expect(authService.refresh(VALID_REFRESH_TOKEN)).rejects.toMatchObject({ status: 401 });
  });

  it('throws 401 when the user is inactive', async () => {
    MockUser.findByPk.mockResolvedValue(makeUser({ is_active: false }) as any);

    await expect(authService.refresh(VALID_REFRESH_TOKEN)).rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// logout()
// ---------------------------------------------------------------------------
describe('authService.logout', () => {
  const JTI = 'jti-logout-test';
  const EXP = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
  const USER_ID = 'user-1';

  beforeEach(() => {
    mockRedis.set.mockResolvedValue('OK' as any);
    mockRedis.scan.mockResolvedValue(['0', [`refresh:${USER_ID}:key1`]] as any);
    mockRedis.del.mockResolvedValue(1 as any);
  });

  it('adds the access-token jti to the Redis blocklist with correct TTL', async () => {
    await authService.logout(JTI, EXP, USER_ID);

    expect(mockRedis.set).toHaveBeenCalledWith(
      `blocklist:${JTI}`,
      '1',
      'EX',
      expect.any(Number)
    );
    // TTL should be positive (token not yet expired)
    const ttlArg = (mockRedis.set as jest.Mock).mock.calls[0][3];
    expect(ttlArg).toBeGreaterThan(0);
  });

  it('does not call blocklist set when the token is already expired', async () => {
    const pastExp = Math.floor(Date.now() / 1000) - 10;
    await authService.logout(JTI, pastExp, USER_ID);

    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('deletes all refresh token keys for the user via SCAN', async () => {
    await authService.logout(JTI, EXP, USER_ID);

    expect(mockRedis.scan).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${USER_ID}:key1`);
  });

  it('does not call del when there are no refresh keys to remove', async () => {
    // SCAN returns no keys
    mockRedis.scan.mockResolvedValue(['0', []] as any);

    await authService.logout(JTI, EXP, USER_ID);

    expect(mockRedis.del).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// forgotPassword()
// ---------------------------------------------------------------------------
describe('authService.forgotPassword', () => {
  beforeEach(() => {
    mockRedis.set.mockResolvedValue('OK' as any);
    mockMailer.sendMail.mockResolvedValue(undefined as any);
  });

  it('stores a reset token and sends an email when the user exists', async () => {
    MockUser.findOne.mockResolvedValue(makeUser() as any);

    await authService.forgotPassword('alice@example.com');

    expect(mockRedis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^reset:/),
      'user-1',
      'EX',
      3600
    );
    expect(mockMailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'alice@example.com' })
    );
  });

  it('returns silently (no error, no email) when no user is found — avoids user enumeration', async () => {
    MockUser.findOne.mockResolvedValue(null);

    await expect(authService.forgotPassword('ghost@example.com')).resolves.toBeUndefined();

    expect(mockMailer.sendMail).not.toHaveBeenCalled();
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('does not throw even when the mailer fails', async () => {
    MockUser.findOne.mockResolvedValue(makeUser() as any);
    mockMailer.sendMail.mockRejectedValue(new Error('SMTP error'));

    await expect(authService.forgotPassword('alice@example.com')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resetPassword()
// ---------------------------------------------------------------------------
describe('authService.resetPassword', () => {
  const TOKEN = 'valid-reset-token';
  const NEW_PASSWORD = 'NewSecure1!';

  beforeEach(() => {
    mockRedis.get.mockResolvedValue('user-1');
    mockRedis.del.mockResolvedValue(1 as any);
    mockRedis.scan.mockResolvedValue(['0', []] as any);
    (mockBcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-pw');

    const unscopedMock = { update: jest.fn().mockResolvedValue([1]) };
    MockUser.unscoped.mockReturnValue(unscopedMock as any);
  });

  it('hashes the new password and updates the user record', async () => {
    await authService.resetPassword(TOKEN, NEW_PASSWORD);

    expect(mockBcrypt.hash).toHaveBeenCalledWith(NEW_PASSWORD, 12);
    const unscopedInstance = (MockUser.unscoped as jest.Mock).mock.results[0].value;
    expect(unscopedInstance.update).toHaveBeenCalledWith(
      { password_hash: 'new-hashed-pw' },
      { where: { id: 'user-1' } }
    );
  });

  it('deletes the reset token from Redis (single-use)', async () => {
    await authService.resetPassword(TOKEN, NEW_PASSWORD);

    expect(mockRedis.del).toHaveBeenCalledWith(`reset:${TOKEN}`);
  });

  it('revokes all existing refresh sessions after password reset', async () => {
    mockRedis.scan.mockResolvedValue(['0', ['refresh:user-1:key1', 'refresh:user-1:key2']] as any);

    await authService.resetPassword(TOKEN, NEW_PASSWORD);

    expect(mockRedis.del).toHaveBeenCalledWith('refresh:user-1:key1', 'refresh:user-1:key2');
  });

  it('throws 400 when the reset token is invalid or expired', async () => {
    mockRedis.get.mockResolvedValue(null);

    await expect(authService.resetPassword('bad-token', NEW_PASSWORD)).rejects.toMatchObject({
      status: 400,
      message: 'Invalid or expired reset token',
    });
  });
});

// ---------------------------------------------------------------------------
// changePassword()
// ---------------------------------------------------------------------------
describe('authService.changePassword', () => {
  const USER_ID = 'user-1';

  function setupChangePassword(userOverrides: Record<string, unknown> = {}) {
    const user = makeUser(userOverrides);
    const scopedMock = { findByPk: jest.fn().mockResolvedValue(user) };
    MockUser.scope.mockReturnValue(scopedMock as any);
    return { user };
  }

  beforeEach(() => {
    (mockBcrypt.hash as jest.Mock).mockResolvedValue('new-hash');
  });

  it('updates the password when current password is correct', async () => {
    const { user } = setupChangePassword();
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

    await authService.changePassword(USER_ID, 'OldPass1', 'NewSecure1!');

    expect(user.update).toHaveBeenCalledWith({ password_hash: 'new-hash' });
  });

  it('throws 404 when the user does not exist', async () => {
    const scopedMock = { findByPk: jest.fn().mockResolvedValue(null) };
    MockUser.scope.mockReturnValue(scopedMock as any);

    await expect(
      authService.changePassword(USER_ID, 'OldPass1', 'NewSecure1!')
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 when the current password is incorrect', async () => {
    setupChangePassword();
    (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      authService.changePassword(USER_ID, 'WrongPass1', 'NewSecure1!')
    ).rejects.toMatchObject({ status: 400, message: 'Current password is incorrect' });
  });
});
