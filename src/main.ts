#!/usr/bin/env node

import childProcess from 'node:child_process';
import util from 'node:util';
// import clear from 'clear';
// clear();
import parseCommand from './cmd.js';
import exitUtils from './utils/exit.js';

const execPromise = util.promisify(childProcess.exec);

async function main(): Promise<void> {
  try {
    process.platform === 'win32' ? await execPromise('chcp 65001') : null;
    // await (async () => {
    //   const rsp = Bun.spawnSync(['net', 'session']);
    //   if (rsp.exitCode !== 0 || rsp.success !== true) {
    //     console.error('This program must be run as an administrator');
    //     process.exit(1);
    //   }
    // })();
    await parseCommand();
  } catch (error) {
    console.log(error);
    exitUtils.pressAnyKeyToExit(1);
  }
}

await main();
