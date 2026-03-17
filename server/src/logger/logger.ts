import winston from 'winston';

const { combine, timestamp, json, colorize, simple } = winston.format;

const isDev = process.env.NODE_ENV !== 'production';

export const logger = winston.createLogger({
  level: isDev ? 'debug' : 'info',
  format: combine(timestamp(), json()),
  transports: [
    isDev
      ? new winston.transports.Console({
          format: combine(colorize(), simple()),
        })
      : new winston.transports.Console(),
    ...(!isDev
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
          }),
        ]
      : []),
  ],
});
