import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis';

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: any[]) => redisClient.call(args[0], ...args.slice(1)) as any,
    prefix: 'rl:global:',
  }),
  message: {
    type: 'https://httpstatuses.com/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Rate limit exceeded. Max 100 requests per minute.',
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args: any[]) => redisClient.call(args[0], ...args.slice(1)) as any,
    prefix: 'rl:auth:',
  }),
  message: {
    type: 'https://httpstatuses.com/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Rate limit exceeded. Max 10 auth requests per minute.',
  },
});
