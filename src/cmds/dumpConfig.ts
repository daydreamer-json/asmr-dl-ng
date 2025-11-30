import path from 'node:path';
import chalk from 'chalk';
import fileUtils from '../utils/file.js';

async function mainCmdHandler() {
  const appConfigPath = path.join(fileUtils.getAppDataDir(), 'config.yaml');
  const userConfigPath = path.join(fileUtils.getAppDataDir(), 'config_user.yaml');
  console.log('App config path:  ' + appConfigPath);
  console.log('User config path: ' + userConfigPath);
  console.log('');
  console.log(chalk.inverse('[ App Config ]') + '\n' + (await Bun.file(appConfigPath).text()));
  console.log(chalk.inverse('[ User Config ]') + '\n' + (await Bun.file(userConfigPath).text()));
}

export default mainCmdHandler;
