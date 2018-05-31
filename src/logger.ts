import * as winston from 'winston';
import config from './config';

const logger = winston.createLogger({
  level: config.log.level,
  format: winston.format.simple(),
  transports: [
    new winston.transports.Console(),
  ],
});

export default logger;
