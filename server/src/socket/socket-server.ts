import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redisClient } from '../config/redis';
import { logger } from '../logger/logger';
import { JwtPayload } from '../middleware/auth-guard';

let io: SocketServer;

export function initSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });

  // Authentication middleware — mirrors the HTTP authGuard:
  // 1. Verify JWT signature and expiry.
  // 2. Check the Redis blocklist so logged-out tokens can't open a socket.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      next(new Error('Invalid token'));
      return;
    }

    // Reject tokens that have been invalidated via logout.
    try {
      const blocked = await redisClient.get(`blocklist:${payload.jti}`);
      if (blocked) {
        next(new Error('Token has been invalidated'));
        return;
      }
    } catch (err) {
      logger.error('Socket blocklist check failed — rejecting connection', { err });
      next(new Error('Internal server error'));
      return;
    }

    (socket as any).user = payload;
    next();
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as JwtPayload;
    const room = `user:${user.sub}`;

    socket.join(room);
    logger.info(`Socket connected: user ${user.sub} joined room ${room}`);

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: user ${user.sub}`);
    });
  });

  return io;
}

export function getIo(): SocketServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocketServer first.');
  }
  return io;
}
