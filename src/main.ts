#!/usr/bin/env node

// import clear from 'clear';
// clear();
import childProcess from 'child_process';
import util from 'util';
import parseCommand from './cmd.js';
const execPromise = util.promisify(childProcess.exec);

async function main(): Promise<void> {
  process.platform === 'win32' ? await execPromise('chcp 65001') : null;
  await parseCommand();
}

await main();
