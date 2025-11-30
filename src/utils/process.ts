import exitUtils from './exit.js';
import logger from './logger.js';

async function checkIsAdmin() {
  const rsp = Bun.spawnSync(['net', 'session']);
  if (rsp.exitCode !== 0 || rsp.success !== true) {
    logger.error('This program must be run as an administrator');
    process.exit(1);
  }
}

async function checkMultiInstance() {
  const rsp = Bun.spawnSync(['tasklist']).stdout;
  const exeName = 'asmr-dl-ng.exe';
  const processCount = (rsp.toString().match(new RegExp(exeName, 'g')) || []).length;
  if (processCount > 1) {
    logger.error('Multiple instances detected. Close other ones and try again');
    await exitUtils.exit(1, null, false);
  }
}

export default {
  checkIsAdmin,
  checkMultiInstance,
};
