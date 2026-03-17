import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
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

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
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
