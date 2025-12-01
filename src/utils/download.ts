import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import ky, { HTTPError } from 'ky';
import ora from 'ora';
import PQueue from 'p-queue';
import prompts from 'prompts';
import { rimraf } from 'rimraf';
import * as uuid from 'uuid';
import YAML from 'yaml';
import * as TypesApiEndpoint from '../types/ApiEndpoint.js';
import * as TypesApiFiles from '../types/ApiFiles.js';
import apiUtils from './api.js';
import argvUtils from './argv.js';
import appConfig from './config.js';
import configReadOnly from './configReadOnly.js';
import configUser from './configUser.js';
import downloadPostUtils from './downloadPost.js';
import exitUtils from './exit.js';
import fileUtils from './file.js';
import logger from './logger.js';
import mathUtils from './math.js';
import rateMeterUtils from './rateMeter.js';
import stringUtils from './string.js';
import termPrettyUtils from './termPretty.js';

async function downloadMeta(workId: number) {
  const spinner = !argvUtils.getArgv()['no-show-progress']
    ? ora({ text: 'Downloading work metadata ...', color: 'cyan', spinner: 'dotsCircle' }).start()
    : undefined;
  const workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
  } = await (async () => {
    try {
      return {
        info: await apiUtils.api.work.info(workId),
        fileEntry: await apiUtils.api.work.fileEntry(workId),
      };
    } catch (error) {
      spinner?.stop();
      if (error instanceof HTTPError) {
        if (error.response.status === 404) {
          logger.error(`Work not found. Please check the ID and try again. ID: ${workId}`);
          await exitUtils.exit(1, null, false);
        } else if (error.response.status === 525) {
          logger.error(`Failed to download metadata: 525 Cloudflare SSL handshake failed`);
          await exitUtils.exit(1, null, false);
        }
        logger.error(`Failed to download metadata: ${error.response.status} ${error.response.statusText}`);
        await exitUtils.exit(1, null, false);
        throw error;
      } else if (error instanceof Error) {
        logger.error(`Failed to download metadata: ${error.message}`);
        await exitUtils.exit(1, null, false);
        throw error;
      } else {
        throw new Error('An unknown error occurred while downloading metadata');
      }
    }
  })();
  const coverImgBuffer: Record<'main' | 'thumb' | 'icon', ArrayBuffer | null> = {
    main: null,
    thumb: null,
    icon: null,
  };
  for (const coverImgType of ['main', 'thumb', 'icon'] as const) {
    try {
      coverImgBuffer[coverImgType] = await apiUtils.api.media.coverImage(workId, coverImgType);
    } catch (error) {
      if (error instanceof HTTPError) {
        if (error.response.status !== 404) {
          logger.error(`Failed to download metadata: ${error.response.status} ${error.response.statusText}`);
          await exitUtils.exit(1, null, false);
          throw error;
        }
      } else if (error instanceof Error) {
        logger.error(`Failed to download metadata: ${error.message}`);
        await exitUtils.exit(1, null, false);
        throw error;
      } else {
        throw new Error('An unknown error occurred while downloading metadata');
      }
    }
  }

  spinner?.stop();
  logger.info('Work metadata downloaded');
  return {
    ...workApiRsp,
    coverImgBuffer,
  };
}

async function filterFileEntry(fileEntries: TypesApiFiles.FilesystemEntryTransformed[]): Promise<string[]> {
  const preFilteredEntries = fileEntries
    .filter((e) =>
      stringUtils.filterByRegex(
        e.path.join('/'),
        configUser.getConfig().file.filterRegex.include,
        configUser.getConfig().file.filterRegex.exclude,
      ),
    )
    .map((e) => e.uuid);

  if (configUser.getConfig().file.useAutoFilterRegex === true) {
    return preFilteredEntries;
  } else {
    const userInputRsp: string[] = (
      await prompts(
        {
          name: 'value',
          type: 'multiselect',
          message: 'Select the files to download',
          instructions: chalk.dim('Space/up/down/left/right to select. A to select all. Return to submit'),
          min: 1,
          choices: fileEntries
            .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
            .map((e) => ({
              title: '/' + e.path.join('/'),
              value: e.uuid,
              selected: preFilteredEntries.includes(e.uuid),
            })),
          onRender(kleur) {
            const _this: any = this;
            if (_this.firstRender) {
              _this.renderDoneOrInstructions = function () {
                if (_this.done) {
                  return `${chalk.green(this.value.filter((e: any) => e.selected).length)} files selected`;
                }
                const output = [kleur.gray(this.hint), this.renderInstructions()];
                if (this.value[this.cursor].disabled) output.push(kleur.yellow(this.warn));
                return output.join(' ');
              };
            }
          },
        },
        {
          onCancel: async () => {
            logger.error('Aborted');
            exitUtils.exit(1, null, false);
          },
        },
      )
    ).value;
    return userInputRsp;
  }
}

async function downloadWork(
  workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
    coverImgBuffer: Record<'main' | 'thumb' | 'icon', ArrayBuffer | null>;
  },
  selectedFilesUuid: string[],
) {
  logger.info('Downloading work ...');
  const workOverallUuid = uuid.v4();
  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));
  if ((await fileUtils.checkFolderExists(tempOutputDirPath)) === false) {
    await fs.promises.mkdir(tempOutputDirPath, { recursive: true });
  }
  await fs.promises.writeFile(
    path.join(tempOutputDirPath, configReadOnly.dlIncompleteText.name),
    configReadOnly.dlIncompleteText.content,
    'utf-8',
  );

  const queue = new PQueue({ concurrency: argvUtils.getArgv()['threadNet'] });

  const needDlFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed.filter((e) =>
    selectedFilesUuid.includes(e.uuid),
  );
  const dledFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = [];
  const filesOverallSize = mathUtils.arrayTotal(needDlFileEntry.map((e) => e.size));
  let dledDataSizeGlobal: number = 0; // bytes

  const rateMeterAvgFactor = 2;
  const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);

  // progress bar initialize
  const progBar = !argvUtils.getArgv()['no-show-progress']
    ? new cliProgress.MultiBar(appConfig.logger.progressBarConfig)
    : undefined;
  const progBarRootPayload = termPrettyUtils.progBarTextFmter.download.root(
    0,
    needDlFileEntry.length,
    dledDataSizeGlobal,
    filesOverallSize,
    rateMeterInstRoot.getRate(),
    0, // Initial active threads should be 0 as no downloads have started yet
  );
  const progBarTitle = progBar?.create(1, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.download.title,
  });
  const progBarRoot = progBar?.create(filesOverallSize, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.download.root,
  });

  needDlFileEntry.forEach((fileEntry) => {
    if (selectedFilesUuid.includes(fileEntry.uuid) === false) return;
    queue.add(async () => {
      const outFilePath = path.join(tempOutputDirPath, fileEntry.uuid);
      let dledDataSize = 0; // bytes
      let retriedCount = 0;
      const progBarSub =
        process.stdout.rows > queue.concurrency + 3
          ? progBar?.create(
              fileEntry.size,
              dledDataSize,
              termPrettyUtils.progBarTextFmter.download.sub(dledDataSize, fileEntry.size, fileEntry.path.at(-1) ?? ''),
              { format: termPrettyUtils.progBarFmtCfg.download.sub },
            )
          : undefined;
      const progBarUpdateFunc = (subCurrent: number) => {
        progBarSub?.update(
          subCurrent,
          termPrettyUtils.progBarTextFmter.download.sub(subCurrent, fileEntry.size, fileEntry.path.at(-1) ?? ''),
        );
        const tmpRootPayload = termPrettyUtils.progBarTextFmter.download.root(
          dledFileEntry.length,
          needDlFileEntry.length,
          dledDataSizeGlobal,
          filesOverallSize,
          rateMeterInstRoot.getRate(),
          Math.abs(queue.pending)
            .toString()
            .padStart(Math.floor(Math.log10(queue.concurrency)) + 1, ' '),
        );
        progBarRoot?.update(dledDataSizeGlobal, tmpRootPayload);
        progBarTitle?.update(0, tmpRootPayload);
      };

      while (retriedCount <= appConfig.network.retryCount) {
        const abortController = new AbortController();
        const rateMeterFile = new rateMeterUtils.RateMeter(1000, true);
        let timeoutTimer: NodeJS.Timeout | null = null;
        let lastNonZeroRateTime = Date.now();

        try {
          timeoutTimer = setInterval(() => {
            if (rateMeterFile.getRate() === 0) {
              if (Date.now() - lastNonZeroRateTime > appConfig.network.timeout) {
                abortController.abort(new Error('Download timeout due to zero speed'));
              }
            } else {
              lastNonZeroRateTime = Date.now();
            }
          }, 1000);

          const progressStream = new stream.Transform({
            transform(chunk, _encoding, callback) {
              dledDataSizeGlobal += chunk.length;
              rateMeterInstRoot.increment(chunk.length);
              rateMeterFile.increment(chunk.length);
              dledDataSize += chunk.length;
              progBarUpdateFunc(dledDataSize);
              if (rateMeterFile.getRate() > 0) {
                lastNonZeroRateTime = Date.now();
              }
              this.push(chunk);
              callback();
            },
          });

          const response = await ky.get(fileEntry.mediaDownloadUrl, {
            ...apiUtils.defaultKySettings,
            signal: abortController.signal,
          });

          await stream.promises.pipeline(
            stream.Readable.fromWeb(response.body as any),
            progressStream,
            fs.createWriteStream(outFilePath, { flags: 'wx' }),
          );
          progBarUpdateFunc(fileEntry.size);
          dledFileEntry.push(fileEntry);
          progBarSub?.stop();
          progBar?.remove(progBarSub!);
          break; // Download succeeded, exit loop
        } catch (error) {
          if (timeoutTimer) clearInterval(timeoutTimer);
          timeoutTimer = null;

          try {
            await fs.promises.unlink(outFilePath);
          } catch (_e) {}

          retriedCount++;
          if (retriedCount > appConfig.network.retryCount) {
            progBar?.stop();
            logger.error(
              `Download failed after ${appConfig.network.retryCount} retries: ${fileEntry.path.at(-1) ?? ''}`,
            );
            throw error;
          }
          // logger.warn(
          //   `Download failed, retrying... (${retriedCount}/${appConfig.network.retryCount}): ${fileEntry.path.join('/')}`,
          // );
          dledDataSizeGlobal -= dledDataSize;
        }

        if (timeoutTimer) clearInterval(timeoutTimer);
        timeoutTimer = null;
      }
    });
  });

  await queue.onIdle();

  progBar?.stop();

  logger.info(
    `Download completed. Speed: ${mathUtils.formatFileSize(rateMeterInstRoot.finalize().rate, {
      decimals: 2,
      decimalPadding: true,
      unitVisible: true,
      useBinaryUnit: true,
      useBitUnit: appConfig.logger.useBitUnitForSpeed,
      unit: null,
    })}${appConfig.logger.useBitUnitForSpeed ? 'ps' : '/s'}`,
  );

  const calculatedHashesArray = await downloadPostUtils.calculateHashes(workApiRsp, selectedFilesUuid, workOverallUuid);

  if (argvUtils.getArgv()['save-metadata'] === true) {
    await (async () => {
      // write meta yaml
      await fs.promises.writeFile(
        path.join(tempOutputDirPath, 'meta.yaml'),
        YAML.stringify({
          info: workApiRsp.info,
          coverImage: Object.fromEntries(Object.entries(workApiRsp.coverImgBuffer).map((e) => [e[0], e[1] !== null])),
          fileEntry: (() => {
            return workApiRsp.fileEntry.transformed
              .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
              .map((e) => {
                if (e.type === 'audio') {
                  const { mediaStreamUrl, mediaDownloadUrl, streamLowQualityUrl, ...rest } = e;
                  return rest;
                } else {
                  const { mediaStreamUrl, mediaDownloadUrl, ...rest } = e;
                  return rest;
                }
              });
          })(),
          downloadedFiles: selectedFilesUuid,
          hash: calculatedHashesArray,
        }),
        'utf-8',
      );
      // write hash table (tab-separated)
      await fs.promises.writeFile(
        path.join(tempOutputDirPath, 'meta_hashes.tsv'),
        calculatedHashesArray
          .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
          .map(
            (e) =>
              `${e.uuid}\t${e.hash.sha256}\t${e.hash.sha384}\t${e.hash.sha512}\t${e.hash['sha3-512']}\t${JSON.stringify(e.path)}`,
          )
          .join('\n'),
        'utf-8',
      );
      // write cover image
      for (const coverImgEntry of Object.entries(workApiRsp.coverImgBuffer)) {
        if (coverImgEntry[1] !== null) {
          await fs.promises.writeFile(
            path.join(tempOutputDirPath, 'meta_cover_' + coverImgEntry[0] + '.jpg'),
            Buffer.from(coverImgEntry[1]),
          );
        }
      }
    })();
  }

  await downloadPostUtils.deobfuscateFilename(workApiRsp, selectedFilesUuid, workOverallUuid);
  await rimraf(tempOutputDirPath);

  logger.info('All download completed!');
}

export default {
  downloadMeta,
  filterFileEntry,
  downloadWork,
};
