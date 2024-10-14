import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import appConfig from './utils/config.js';
import testMainCmdHandler from './download.js';
// import test2MainCmdHandler from './test2.js';
import argvUtils from './utils/argv.js';

async function parseCommand() {
  const yargsInstance = yargs(hideBin(process.argv));
  await yargsInstance
    .command(
      ['download [id]', 'dl'],
      'Download work',
      (yargs) => {
        yargs
          .positional('id', {
            describe: 'DLsite RJ Code (Work ID)',
            type: 'number',
          })
          .options({
            'output-dir': {
              alias: ['o'],
              desc: 'Output root directory',
              default: path.resolve(appConfig.file.outputDir),
              normalize: true,
              type: 'string',
            },
            // force: {
            //   alias: ['f'],
            //   desc: 'Force overwrites existing files',
            //   default: false,
            //   type: 'boolean',
            // },
            thread: {
              alias: ['t'],
              desc: 'Set network thread count',
              default: appConfig.network.threadCount,
              type: 'number',
            },
            'save-metadata': {
              alias: ['m'],
              desc: 'Save work metadata to output directory',
              default: true,
              type: 'boolean',
            },
            lang: {
              desc: 'Set language of work metadata',
              default: 'ja-jp',
              deprecated: false,
              choices: ['ja-jp', 'en-us', 'zh-cn'],
              type: 'string',
            },
            server: {
              desc: 'Set API server',
              default: 'latest',
              choices: ['latest', 'original', 'mirror1', 'mirror2', 'mirror3'],
              type: 'string',
            },
            // proxy: {
            //   desc: 'Use streaming API server',
            //   default: false,
            //   type: 'boolean',
            // },
            'no-show-progress': {
              alias: ['np'],
              desc: 'Do not show download progress',
              default: false,
              type: 'boolean',
            },
            'log-level': {
              desc: 'Set log level',
              default: 'trace',
              deprecated: false,
              choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
              type: 'string',
            },
          });
      },
      async (argv) => {
        argvUtils.setArgv(argv);
        await testMainCmdHandler();
      },
    )
    .usage('$0 <command> [argument] [option]')
    .help()
    .version()
    .demandCommand(1)
    .strict()
    .recommendCommands()
    .parse();
}

export default parseCommand;
