import cors from 'cors';
import { env } from '../config/env';

export const corsConfig = cors({
  origin: (origin, callback) => {
    // In development allow requests with no Origin (curl, Postman, server-to-server).
    // In all other environments an explicit Origin is required so that
    // server-side forgery and tool-based attacks can't bypass CORS.
    if (!origin) {
      if (env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS: Origin header is required'));
      }
      return;
    }
    if (env.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // X-Requested-With is sent by the SPA on every request as a lightweight
  // CSRF mitigation; it must be whitelisted here so preflight passes.
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
});
