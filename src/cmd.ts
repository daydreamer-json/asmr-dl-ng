// import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import cmds from './cmds.js';
import * as TypesApi from './types/Api.js';
import * as TypesLogLevels from './types/LogLevels.js';
import argvUtils from './utils/argv.js';
import appConfig from './utils/config.js';
import configEmbed from './utils/configEmbed.js';
import configUser from './utils/configUser.js';
import exitUtils from './utils/exit.js';
import logger from './utils/logger.js';

if (configEmbed.VERSION_NUMBER === null) throw new Error('Embed VERSION_NUMBER is null');

function wrapHandler(handler: (argv: any) => Promise<void>) {
  return async (argv: any) => {
    try {
      await handler(argv);
      await new Promise((resolve) => setTimeout(resolve, 50)); //! libuv assertion error workaround
      await exitUtils.exit(0);
    } catch (error) {
      logger.error('Error caught:', error);
      await exitUtils.exit(1);
    }
  };
}

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
              default: configUser.getConfig().file.outputDirPath,
              normalize: true,
              type: 'string',
            },
            'output-dir-pattern': {
              desc: 'Output directory pattern',
              default: configUser.getConfig().file.outputDirPattern,
              type: 'string',
            },
            // force: {
            //   alias: ['f'],
            //   desc: 'Force overwrites existing files',
            //   default: false,
            //   type: 'boolean',
            // },
            'thread-net': {
              alias: ['tn'],
              desc: 'Number of threads used for network',
              default: appConfig.threadCount.network,
              type: 'number',
            },
            'thread-hash': {
              alias: ['th'],
              desc: 'Number of threads used for file hashing',
              default: appConfig.threadCount.hashing,
              type: 'number',
            },
            'save-metadata': {
              alias: ['m'],
              desc: 'Save work metadata to output directory',
              default: false,
              type: 'boolean',
            },
            // lang: {
            //   desc: 'Set language of work metadata',
            //   default: 'ja-jp',
            //   deprecated: false,
            //   choices: ['ja-jp', 'en-us', 'zh-cn'],
            //   type: 'string',
            // },
            server: {
              desc: 'Set API server',
              default: 'latest',
              choices: TypesApi.serverNameArray,
              type: 'string',
            },
            // proxy: {
            //   desc: 'Use streaming server',
            //   default: false,
            //   type: 'boolean',
            // },
            'no-show-progress': {
              alias: ['np'],
              desc: 'Do not show download progress',
              default: false,
              type: 'boolean',
            },
          });
      },
      wrapHandler(cmds.download),
    )
    .command(
      ['info [id]'],
      'Show metadata of work',
      (yargs) => {
        yargs
          .positional('id', {
            describe: 'DLsite RJ Code (Work ID)',
            type: 'number',
          })
          .options({
            // lang: {
            //   desc: 'Set language of work metadata',
            //   default: 'ja-jp',
            //   deprecated: false,
            //   choices: ['ja-jp', 'en-us', 'zh-cn'],
            //   type: 'string',
            // },
            server: {
              desc: 'Set API server',
              default: 'latest',
              choices: TypesApi.serverNameArray,
              type: 'string',
            },
            'no-show-progress': {
              alias: ['np'],
              desc: 'Do not show download progress',
              default: false,
              type: 'boolean',
            },
          });
      },
      wrapHandler(cmds.info),
    )
    .command(
      ['dumpConfig'],
      'Dump app config',
      (yargs) => {
        yargs.options({});
      },
      wrapHandler(cmds.dumpConfig),
    )
    .options({
      'log-level': {
        desc: `Set log level (${TypesLogLevels.LOG_LEVELS_NUM.join(', ')})`,
        default: appConfig.logger.logLevel,
        type: 'number',
        coerce: (arg: number): TypesLogLevels.LogLevelString => {
          if (arg < TypesLogLevels.LOG_LEVELS_NUM[0] || arg > TypesLogLevels.LOG_LEVELS_NUM.slice(-1)[0]!) {
            throw new Error(`Invalid log level: ${arg} (Expected: ${TypesLogLevels.LOG_LEVELS_NUM.join(', ')})`);
          } else {
            return TypesLogLevels.LOG_LEVELS[arg as TypesLogLevels.LogLevelNumber];
          }
        },
      },
    })
    .middleware(async (argv) => {
      argvUtils.setArgv(argv);
      logger.level = argvUtils.getArgv()['logLevel'];
      logger.trace('Process started');
    })
    .scriptName(configEmbed.APPLICATION_NAME)
    .version(String(configEmbed.VERSION_NUMBER))
    .usage('$0 <command> [argument] [option]')
    .help()
    .alias('help', 'h')
    .alias('help', '?')
    .alias('version', 'V')
    .demandCommand(1)
    .strict()
    .recommendCommands()
    .parse();
}

export default parseCommand;
