import log4js from 'log4js';
import appConfig from './config.js';
import argvUtils from './argv.js';

log4js.configure({
  appenders: {
    System: {
      type: 'stdout',
    },
  },
  categories: {
    default: {
      appenders: ['System'],
      level: appConfig.logger.logLevel,
    },
  },
});

const logger: log4js.Logger = log4js.getLogger('System');
logger.trace('Logger initialized');
export default logger;
