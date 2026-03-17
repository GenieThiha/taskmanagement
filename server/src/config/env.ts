const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isTest = NODE_ENV === 'test';

const required = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET', 'REFRESH_SECRET'];

if (!isTest) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-secret',
  REFRESH_SECRET: process.env.REFRESH_SECRET ?? 'dev-refresh-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '15m',
  REFRESH_EXPIRES_IN: process.env.REFRESH_EXPIRES_IN ?? '7d',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  SES_REGION: process.env.SES_REGION ?? 'ap-southeast-1',
  SES_FROM: process.env.SES_FROM ?? 'noreply@tma.internal',
};
