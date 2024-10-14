import { DateTime } from 'luxon';

import appConfig from './utils/config.js';
import argvUtils from './utils/argv.js';
import logger from './utils/logger.js';
import nicUtils from './utils/nicUtils.js';
import downloadUtils from './utils/downloadUtils.js';
import prompts from 'prompts';

async function mainCmdHandler() {
  logger.level = argvUtils.getArgv().logLevel;
  process.platform === 'win32'
    ? await (async () => {
        const netshCmdRsp = await nicUtils.getNetshInfo();
        await nicUtils.checkIsUsingTempIpv6(netshCmdRsp);
      })()
    : null;
  let downloadWorkId: number;
  if ('id' in argvUtils.getArgv()) {
    downloadWorkId = argvUtils.getArgv().id;
  } else {
    downloadWorkId = (
      await prompts({
        type: 'number',
        name: 'value',
        message: 'Enter DLsite RJ Code (Work ID)',
        initial: 1,
        min: 1,
        max: 99999999,
      })
    ).value;
  }
  if (!downloadWorkId) {
    logger.error('Invalid RJ code');
    process.exit(1);
  }
  // console.log(downloadWorkId);
  // await downloadUtils.singleDownload(276666); 数多いやつ
  // await downloadUtils.singleDownload(1182574); 長いやつ
  // await downloadUtils.singleDownload(1030680); 小さいやつ
  // const downloadWorkId = 1030680;
  await downloadUtils.singleDownload(downloadWorkId);
}

export default mainCmdHandler;
