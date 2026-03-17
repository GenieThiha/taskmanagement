import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { helmetConfig } from './middleware/helmet-config';
import { corsConfig } from './middleware/cors-config';
import { globalRateLimiter, authRateLimiter } from './middleware/rate-limit';
import { authGuard } from './middleware/auth-guard';
import { morganStream } from './logger/morgan-stream';
import { logger } from './logger/logger';

import authRouter from './services/auth/auth-router';
import taskRouter from './services/tasks/task-router';
import userRouter from './services/users/user-router';
import projectRouter from './services/projects/project-router';
import notificationRouter from './services/notifications/notification-router';

export function createApp() {
  const app = express();

  // 1. Helmet security headers
  app.use(helmetConfig);

  // 2. CORS
  app.use(corsConfig);

  // 3. Cookie parser (must come before any route that reads req.cookies)
  app.use(cookieParser());

  // 4. Body parser
  app.use(express.json({ limit: '100kb' }));

  // 5. HTTP request logging
  app.use(
    morgan('combined', {
      stream: morganStream,
      skip: (req) => req.url === '/health',
    })
  );

  // 6. Auth routes (with auth rate limiter — no authGuard needed)
  app.use('/v1/auth', authRateLimiter, authRouter);

  // 7. Task routes
  app.use('/v1/tasks', globalRateLimiter, authGuard, taskRouter);

  // 8. User routes
  app.use('/v1/users', globalRateLimiter, authGuard, userRouter);

  // 9. Project routes
  app.use('/v1/projects', globalRateLimiter, authGuard, projectRouter);

  // 10. Notification routes
  app.use('/v1/notifications', globalRateLimiter, authGuard, notificationRouter);

  // 11. Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // 12. Global error handler (last)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? err.statusCode ?? 500;
    logger.error('Unhandled error', { err: err.message, stack: err.stack });

    res.status(status).json({
      type: `https://httpstatuses.com/${status}`,
      title: err.title ?? (status >= 500 ? 'Internal Server Error' : err.message),
      status,
      detail: status >= 500 ? 'An unexpected error occurred' : err.message,
    });
  });

  return app;
}
