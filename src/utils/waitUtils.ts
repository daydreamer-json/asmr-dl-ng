import logger from './logger.js';

async function waitTime(ms: number, logging: boolean = true) {
  logging === true ? logger.trace(`Waiting ${ms} ms ...`) : null;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  waitTime,
};
