import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../models/user.model';
import { redisClient } from '../../config/redis';
import { mailer } from '../../config/mailer';
import { env } from '../../config/env';
import { logger } from '../../logger/logger';

const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const RESET_TOKEN_TTL = 60 * 60; // 1 hour in seconds

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(userId: string, email: string, role: string): TokenPair {
  const jti = uuidv4();
  const accessToken = jwt.sign(
    { sub: userId, email, role, jti },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );

  const refreshJti = uuidv4();
  const refreshToken = jwt.sign(
    { sub: userId, jti: refreshJti },
    env.REFRESH_SECRET,
    { expiresIn: env.REFRESH_EXPIRES_IN as any }
  );

  return { accessToken, refreshToken };
}

// Safe O(N) Redis key scan using SCAN instead of KEYS so the server is never
// blocked while iterating a large keyspace.
async function scanKeys(pattern: string): Promise<string[]> {
  const found: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    found.push(...batch);
  } while (cursor !== '0');
  return found;
}

export async function register(data: {
  email: string;
  password: string;
  full_name: string;
}) {
  const existing = await User.unscoped().findOne({
    where: { email: data.email },
  });
  if (existing) {
    const err = new Error('Email already registered');
    (err as any).status = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
  const user = await User.create({
    email: data.email,
    password_hash,
    full_name: data.full_name,
    role: 'member',
  });

  const { password_hash: _, ...safeUser } = user.toJSON() as any;
  return safeUser;
}

export async function login(email: string, password: string) {
  const user = await User.scope('withPassword').findOne({ where: { email } });
  if (!user) {
    const err = new Error('Invalid credentials');
    (err as any).status = 401;
    throw err;
  }

  if (!user.is_active) {
    const err = new Error('Account is inactive');
    (err as any).status = 401;
    throw err;
  }

  if (user.locked_until && user.locked_until > new Date()) {
    const err = new Error('Account is temporarily locked. Try again later.');
    (err as any).status = 423;
    throw err;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const attempts = (user.failed_login_attempts ?? 0) + 1;
    const updateData: Partial<{
      failed_login_attempts: number;
      locked_until: Date | null;
    }> = { failed_login_attempts: attempts };

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await user.update(updateData);

    const err = new Error('Invalid credentials');
    (err as any).status = 401;
    throw err;
  }

  // Reset login attempts on success
  await user.update({ failed_login_attempts: 0, locked_until: null });

  const tokens = issueTokens(user.id, user.email, user.role ?? 'member');

  // Store refresh token JTI in Redis
  const refreshPayload = jwt.decode(tokens.refreshToken) as any;
  await redisClient.set(
    `refresh:${user.id}:${refreshPayload.jti}`,
    '1',
    'EX',
    7 * 24 * 60 * 60
  );

  const { password_hash: _, ...safeUser } = user.toJSON() as any;
  return { user: safeUser, ...tokens };
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  let payload: any;
  try {
    payload = jwt.verify(refreshToken, env.REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid refresh token');
    (err as any).status = 401;
    throw err;
  }

  const key = `refresh:${payload.sub}:${payload.jti}`;
  const exists = await redisClient.get(key);
  if (!exists) {
    const err = new Error('Refresh token expired or revoked');
    (err as any).status = 401;
    throw err;
  }

  const user = await User.findByPk(payload.sub);
  if (!user || !user.is_active) {
    const err = new Error('User not found or inactive');
    (err as any).status = 401;
    throw err;
  }

  // Rotate: delete old refresh key, issue new token pair
  await redisClient.del(key);

  const tokens = issueTokens(user.id, user.email, user.role ?? 'member');
  const newRefreshPayload = jwt.decode(tokens.refreshToken) as any;
  await redisClient.set(
    `refresh:${user.id}:${newRefreshPayload.jti}`,
    '1',
    'EX',
    7 * 24 * 60 * 60
  );

  return tokens;
}

export async function logout(jti: string, exp: number, userId: string) {
  try {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redisClient.set(`blocklist:${jti}`, '1', 'EX', ttl);
    }

    // Delete all refresh tokens for this user using SCAN (non-blocking).
    const keys = await scanKeys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (err) {
    logger.warn('Error during logout cleanup', { err });
  }
}

export async function forgotPassword(email: string) {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Return silently to avoid user enumeration
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  await redisClient.set(`reset:${token}`, user.id, 'EX', RESET_TOKEN_TTL);

  try {
    // Use APP_URL env var so the link works in every environment.
    const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
    await mailer.sendMail({
      from: env.SES_FROM,
      to: email,
      subject: 'TMA - Password Reset Request',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    });
  } catch (err) {
    logger.warn('Failed to send password reset email', { err, email });
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await redisClient.get(`reset:${token}`);
  if (!userId) {
    const err = new Error('Invalid or expired reset token');
    (err as any).status = 400;
    throw err;
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await User.unscoped().update({ password_hash }, { where: { id: userId } });

  // Single-use: remove the reset key immediately
  await redisClient.del(`reset:${token}`);

  // Revoke all active sessions so old refresh tokens can't be used after a reset
  const sessionKeys = await scanKeys(`refresh:${userId}:*`);
  if (sessionKeys.length > 0) {
    await redisClient.del(...sessionKeys);
  }
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
) {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) {
    const err = new Error('User not found');
    (err as any).status = 404;
    throw err;
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    (err as any).status = 400;
    throw err;
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.update({ password_hash });
}
