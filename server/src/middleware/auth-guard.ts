import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redisClient } from '../config/redis';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authGuard(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      type: 'https://httpstatuses.com/401',
      title: 'Unauthorized',
      status: 401,
      detail: 'Missing or invalid Authorization header',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Check Redis blocklist
    const blocked = await redisClient.get(`blocklist:${payload.jti}`);
    if (blocked) {
      res.status(401).json({
        type: 'https://httpstatuses.com/401',
        title: 'Unauthorized',
        status: 401,
        detail: 'Token has been invalidated',
      });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({
      type: 'https://httpstatuses.com/401',
      title: 'Unauthorized',
      status: 401,
      detail: 'Invalid or expired token',
    });
  }
}
