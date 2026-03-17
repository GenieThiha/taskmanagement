import http from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { sequelize } from './models/index';
import { initSocketServer } from './socket/socket-server';
import { startDueSoonJob } from './services/notifications/due-soon-job';
import { logger } from './logger/logger';

async function bootstrap() {
  // Initialize models and associations
  await import('./models/index');

  const app = createApp();
  const httpServer = http.createServer(app);

  // Attach Socket.io
  initSocketServer(httpServer);

  // Test DB connection
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
  } catch (err) {
    logger.error('Unable to connect to the database', { err });
    process.exit(1);
  }

  // Start HTTP server
  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Start scheduled jobs
  startDueSoonJob();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    httpServer.close(async () => {
      await sequelize.close();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
