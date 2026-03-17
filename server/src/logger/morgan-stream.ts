import { logger } from './logger';
import { StreamOptions } from 'morgan';

export const morganStream: StreamOptions = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
