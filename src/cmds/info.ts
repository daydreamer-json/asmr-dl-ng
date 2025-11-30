import ora from 'ora';
import prompts from 'prompts';
import * as TypesApi from '../types/Api.js';
import apiUtils from '../utils/api.js';
import argvUtils from '../utils/argv.js';
import downloadUtils from '../utils/download.js';
import exitUtils from '../utils/exit.js';
import logger from '../utils/logger.js';
import termPrettyUtils from '../utils/termPretty.js';

async function mainCmdHandler() {
  if (!('id' in argvUtils.getArgv())) {
    logger.warn('Work ID has not been specified. Requesting ...');
    const idRsp: number = (
      await prompts(
        { name: 'value', type: 'number', message: 'Enter work ID' },
        {
          onCancel: async () => {
            logger.error('Aborted');
            exitUtils.exit(1, null, false);
          },
        },
      )
    ).value;
    argvUtils.setArgv({ ...argvUtils.getArgv(), id: idRsp });
  }
  apiUtils.setBaseUri(argvUtils.getArgv()['server'] as TypesApi.ServerName);

  await (async () => {
    const spinner = !argvUtils.getArgv()['no-show-progress']
      ? ora({ text: 'Checking API health ...', color: 'cyan', spinner: 'dotsCircle' }).start()
      : undefined;
    const apiHealthRsp = await apiUtils.api.health();
    spinner?.stop();
    if (apiHealthRsp.available === true) {
      logger.info('API health check succeeded');
    } else {
      throw new Error('API health check failed');
    }
  })();

  const workApiRsp = await downloadUtils.downloadMeta(argvUtils.getArgv()['id']);

  console.log(termPrettyUtils.printWorkInfo(workApiRsp));
}

export default mainCmdHandler;
