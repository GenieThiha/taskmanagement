const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isTest = NODE_ENV === 'test';
const isProduction = NODE_ENV === 'production';

// Required in every non-test environment (dev + staging + production).
const required = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'REFRESH_SECRET',
  // APP_URL must be set so password-reset links point to the right host.
  'APP_URL',
];

// SES credentials are only needed in production — development uses Mailhog
// (a local SMTP catch-all) so no real credentials are required.
const requiredInProduction = ['SES_SMTP_USER', 'SES_SMTP_PASS'];

if (!isTest) {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

if (isProduction) {
  const missing = requiredInProduction.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

// Fallback values are only ever reached in the test environment because the
// required-variable check above will have thrown for any other environment.
// Use long, explicit strings so they can never be mistaken for production secrets.
export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? 'test-only-jwt-secret-not-for-production-use',
  REFRESH_SECRET: process.env.REFRESH_SECRET ?? 'test-only-refresh-secret-not-for-production-use',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '15m',
  REFRESH_EXPIRES_IN: process.env.REFRESH_EXPIRES_IN ?? '7d',
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  // Required in all non-test environments (enforced by the check above).
  APP_URL: process.env.APP_URL ?? 'http://localhost:5173',
  SES_REGION: process.env.SES_REGION ?? 'ap-southeast-1',
  SES_FROM: process.env.SES_FROM ?? 'noreply@tma.internal',
  // Routed through env so validation catches a missing value on startup.
  SES_SMTP_USER: process.env.SES_SMTP_USER ?? '',
  SES_SMTP_PASS: process.env.SES_SMTP_PASS ?? '',
};
