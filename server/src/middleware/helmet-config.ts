import helmet from 'helmet';

export const helmetConfig = helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Tailwind CSS is compiled to a static stylesheet at build time —
      // no unsafe-inline needed at runtime.
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
    },
  },
});
