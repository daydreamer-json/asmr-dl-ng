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
  if (!('id' in argvUtils.getArgv()) || argvUtils.getArgv()['id'].length === 0) {
    logger.warn('Work ID has not been specified. Requesting ...');
    const idRsp: number = (
      await prompts(
        {
          name: 'value',
          type: 'number',
          message: 'Enter work ID',
          validate: (value) => (Boolean(value) ? true : 'Invalid value'),
        },
        {
          onCancel: async () => {
            logger.error('Aborted');
            exitUtils.exit(1, null, false);
          },
        },
      )
    ).value;
    argvUtils.setArgv({ ...argvUtils.getArgv(), id: [idRsp] });
  }
  apiUtils.setBaseUri(argvUtils.getArgv()['server'] as TypesApi.ServerName);

  for (const workId of argvUtils.getArgv()['id']) {
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

    const workApiRsp = await downloadUtils.downloadMeta(workId);

    console.log(termPrettyUtils.printWorkInfo(workApiRsp));

    const selectedFilesUuid = await downloadUtils.filterFileEntry(workApiRsp.fileEntry.transformed);

    await downloadUtils.downloadWork(workApiRsp, selectedFilesUuid);
  }
}

export default mainCmdHandler;
