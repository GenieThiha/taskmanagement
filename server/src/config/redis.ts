import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../logger/logger';

let redisClient: Redis;

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { err }));

  return client;
}

if (!redisClient!) {
  redisClient = createRedisClient();
}

export { redisClient };
