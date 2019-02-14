import {createLogger, format, transports} from 'winston';
import config from './config';

const logger = createLogger({
  level: config.log.level,
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.json()
  ),
  transports: [
    new transports.Console(),
  ],
});

export default logger;
