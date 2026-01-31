import fs from 'node:fs';
import path from 'node:path';
import cliProgress from 'cli-progress';
import ora from 'ora';
import PQueue from 'p-queue';
import { rimraf } from 'rimraf';
import * as TypesApiEndpoint from '../types/ApiEndpoint.js';
import * as TypesApiFiles from '../types/ApiFiles.js';
import argvUtils from './argv.js';
import appConfig from './config.js';
import configUser from './configUser.js';
import fileUtils from './file.js';
import logger from './logger.js';
import mathUtils from './math.js';
import rateMeterUtils from './rateMeter.js';
import stringUtils from './string.js';
import termPrettyUtils from './termPretty.js';

async function calculateHashes(
  workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
  },
  selectedFilesUuid: string[],
  workOverallUuid: string,
) {
  logger.info('Calculating file hashes ...');

  //! Worker script is hardcoded here to avoid bun build issue
  const workerScript = `{{{HASH_WORKER_PLACEHOLDER}}}`;
  const workerBlob = new Blob([workerScript], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(workerBlob);
  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));
  const results: {
    path: string[];
    uuid: string;
    hash: Record<'sha256' | 'sha384' | 'sha512' | 'sha3-512', string>;
  }[] = [];
  const hashAlgorithms = ['sha256', 'sha384', 'sha512', 'sha3-512'];
  const queue = new PQueue({ concurrency: argvUtils.getArgv()['thread-hash'] });

  const needCalcFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed.filter((e) =>
    selectedFilesUuid.includes(e.uuid),
  );
  const filesOverallSize = mathUtils.arrayTotal(needCalcFileEntry.map((e) => e.size));
  let finishDataSizeGlobal: number = 0; // bytes

  const rateMeterAvgFactor = 2;
  const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);

  const progBar = !argvUtils.getArgv()['no-show-progress']
    ? new cliProgress.MultiBar(appConfig.logger.progressBarConfig)
    : undefined;
  const progBarRootPayload = termPrettyUtils.progBarTextFmter.download.root(
    0,
    needCalcFileEntry.length,
    finishDataSizeGlobal,
    filesOverallSize,
    rateMeterInstRoot.getRate(),
    argvUtils.getArgv()['thread-hash'],
  );
  const progBarTitle = progBar?.create(filesOverallSize, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.hashing.title,
  });
  const progBarRoot = progBar?.create(filesOverallSize, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.download.root,
  });

  needCalcFileEntry.forEach((fileEntry) => {
    queue.add(async () => {
      const filePath = path.join(tempOutputDirPath, fileEntry.uuid);

      let finishDataSize = 0;
      const rateMeterFile = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);
      const progBarSub =
        process.stdout.rows > queue.concurrency + 3
          ? progBar?.create(
              fileEntry.size,
              finishDataSize,
              termPrettyUtils.progBarTextFmter.download.sub(
                finishDataSize,
                fileEntry.size,
                rateMeterFile.getRate(),
                fileEntry.path.at(-1) ?? '',
              ),
              { format: termPrettyUtils.progBarFmtCfg.download.sub },
            )
          : undefined;

      await new Promise<void>((resolve, reject) => {
        // Import the worker script as text and create a Blob URL
        // to ensure it's bundled into the final executable.
        const worker = new Worker(workerUrl);
        const progBarUpdateFunc = (subCurrent: number) => {
          progBarSub?.update(
            subCurrent,
            termPrettyUtils.progBarTextFmter.download.sub(
              subCurrent,
              fileEntry.size,
              rateMeterFile.getRate(),
              fileEntry.path.at(-1) ?? '',
            ),
          );
          const tmpRootPayload = termPrettyUtils.progBarTextFmter.download.root(
            results.length,
            needCalcFileEntry.length,
            finishDataSizeGlobal,
            filesOverallSize,
            rateMeterInstRoot.getRate(),
            Math.abs(queue.pending)
              .toString()
              .padStart(Math.floor(Math.log10(queue.concurrency)) + 1, ' '),
          );
          progBarRoot?.update(finishDataSizeGlobal, tmpRootPayload);
          progBarTitle?.update(0, tmpRootPayload);
        };

        worker.onmessage = (
          event: MessageEvent<
            | { type: 'progress'; chunk_size: number }
            | { type: 'done'; result: Record<'sha256' | 'sha384' | 'sha512' | 'sha3-512', string> }
            | { type: 'error'; error: { message: string; stack?: string } }
          >,
        ) => {
          const data = event.data;
          switch (data.type) {
            case 'progress':
              finishDataSizeGlobal += data.chunk_size;
              finishDataSize += data.chunk_size;
              rateMeterInstRoot.increment(data.chunk_size);
              rateMeterFile.increment(data.chunk_size);
              progBarUpdateFunc(finishDataSize);
              break;
            case 'done':
              results.push({ path: fileEntry.path, uuid: fileEntry.uuid, hash: data.result });
              progBarUpdateFunc(fileEntry.size);
              progBarSub?.stop();
              progBar?.remove(progBarSub!);
              worker.terminate();
              resolve();
              break;
            case 'error':
              console.error(`Worker error for ${fileEntry.path.join('/')}:`, data.error);
              worker.terminate();
              reject(new Error(`Worker error for ${fileEntry.path.join('/')}: ${data.error.message}`));
              break;
          }
        };

        worker.onerror = (err) => {
          // This catches errors that prevent the worker script from loading or executing.
          console.error(`A critical error occurred in the worker for ${fileEntry.path.join('/')}:`, err);
          worker.terminate();
          reject(new Error(`Worker failed for ${fileEntry.path.join('/')}: ${err.message}`));
        };

        worker.postMessage({
          filePath,
          algorithms: hashAlgorithms,
        });
      });
    });
  });

  await queue.onIdle();

  progBar?.stop();
  URL.revokeObjectURL(workerUrl);

  logger.info(
    'All file hashes calculated. Speed: ' +
      mathUtils.formatFileSize(rateMeterInstRoot.finalize().rate, {
        decimals: 2,
        decimalPadding: true,
        unitVisible: true,
        useBinaryUnit: true,
        useBitUnit: appConfig.logger.useBitUnitForSpeed,
        unit: null,
      }) +
      (appConfig.logger.useBitUnitForSpeed ? 'ps' : '/s'),
  );
  return results;
}

async function deobfuscateFilename(
  workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    infoOrig: any;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
    coverImgBuffer: Record<'main' | 'thumb' | 'icon', ArrayBuffer | null>;
  },
  encodeResponse: Record<'flac' | 'wavPack' | 'aac' | 'opus', { uuid: string; result: any }[]>,
  selectedFilesUuid: string[],
  workOverallUuid: string,
) {
  const spinner = !argvUtils.getArgv()['no-show-progress']
    ? ora({ text: 'Deobfuscating file name ...', color: 'cyan', spinner: 'dotsCircle' }).start()
    : undefined;

  const oldOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));
  const newOutputDirPathRoot = path.resolve(
    path.join(
      argvUtils.getArgv()['outputDir'],
      (() => {
        const replaceArray: [RegExp, string][] = [
          [/<WORK_ID>/g, workApiRsp.info.source_id],
          [
            /<WORK_TITLE>/g,
            stringUtils.sanitizeFilename(workApiRsp.infoOrig ? workApiRsp.infoOrig.work_name : workApiRsp.info.title),
          ],
          [/<CIRCLE_ID>/g, workApiRsp.info.circle.source_id],
          [/<CIRCLE_NAME>/g, stringUtils.sanitizeFilename(workApiRsp.info.circle.name)],
          [/<VA_NAME>/g, workApiRsp.info.vas.map((e) => stringUtils.sanitizeFilename(e.name)).join(',')],
          [/<RELEASED_DATE>/g, workApiRsp.info.release],
          [/<CREATED_DATE>/g, workApiRsp.info.create_date],
          // <AUDIO_BIT_DEPTH>, <AUDIO_SAMPLE_RATE> is not implemented yet
        ];
        return stringUtils.replaceMultiPatterns(replaceArray, argvUtils.getArgv()['outputDirPattern']);
      })(),
    ),
  );

  if ((await fileUtils.checkFolderExists(newOutputDirPathRoot)) === true) {
    await rimraf(newOutputDirPathRoot);
  } else {
    await fs.promises.mkdir(newOutputDirPathRoot, { recursive: true });
  }

  const needProcessFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed.filter(
    (e) => selectedFilesUuid.includes(e.uuid),
  );

  const encodedUuidFlatArray = [
    ...new Set([
      ...encodeResponse['flac'].map((e) => e.uuid),
      ...encodeResponse['wavPack'].map((e) => e.uuid),
      ...encodeResponse['aac'].map((e) => e.uuid),
      ...encodeResponse['opus'].map((e) => e.uuid),
    ]),
  ];

  for (const fileEntry of needProcessFileEntry) {
    const oldFilePath = path.join(oldOutputDirPath, fileEntry.uuid);
    const newFilePath = path.join(newOutputDirPathRoot, ...fileEntry.path.map((e) => stringUtils.sanitizeFilename(e)));

    if (encodedUuidFlatArray.includes(fileEntry.uuid) && configUser.getConfig().media.deleteOrigFile === true) {
      continue;
    }

    if ((await fileUtils.checkFolderExists(path.dirname(newFilePath))) === false) {
      await fs.promises.mkdir(path.dirname(newFilePath), { recursive: true });
    }
    await fs.promises.rename(oldFilePath, newFilePath);
  }

  await (async () => {
    for (const encodedUuid of encodedUuidFlatArray) {
      const isEncoded: Record<'flac' | 'wavPack' | 'aac' | 'opus', boolean> = {
        flac: encodeResponse['flac'].map((e) => e.uuid).includes(encodedUuid),
        wavPack: encodeResponse['wavPack'].map((e) => e.uuid).includes(encodedUuid),
        aac: encodeResponse['aac'].map((e) => e.uuid).includes(encodedUuid),
        opus: encodeResponse['opus'].map((e) => e.uuid).includes(encodedUuid),
      };
      const renameFunc = async (
        keyName: 'flac' | 'wavPack' | 'aac' | 'opus',
        oldFileSuffix: string,
        newFileExt: string,
        newFolderPrefix: string,
      ) => {
        if (isEncoded[keyName]) {
          const oldFilePath = path.join(oldOutputDirPath, encodedUuid + oldFileSuffix);
          const newOrigFilePath = path.join(
            newOutputDirPathRoot,
            ...needProcessFileEntry
              .find((e) => e.uuid === encodedUuid)!
              .path.map((e) => stringUtils.sanitizeFilename(e)),
          );
          const newOrigFilePathFallback = path.join(
            newOutputDirPathRoot,
            newFolderPrefix,
            ...needProcessFileEntry
              .find((e) => e.uuid === encodedUuid)!
              .path.map((e) => stringUtils.sanitizeFilename(e)),
          );
          const newFilePath = path.join(
            path.dirname(newOrigFilePath),
            path.basename(newOrigFilePath, path.extname(newOrigFilePath)) + newFileExt,
          );
          const newFilePathFallback = path.join(
            path.dirname(newOrigFilePathFallback),
            path.basename(newOrigFilePathFallback, path.extname(newOrigFilePathFallback)) + newFileExt,
          );
          if (await fileUtils.checkFileExists(newFilePath)) {
            if ((await fileUtils.checkFolderExists(path.dirname(newFilePathFallback))) === false) {
              await fs.promises.mkdir(path.dirname(newFilePathFallback), { recursive: true });
            }
            await fs.promises.rename(oldFilePath, newFilePathFallback);
          } else {
            if ((await fileUtils.checkFolderExists(path.dirname(newFilePath))) === false) {
              await fs.promises.mkdir(path.dirname(newFilePath), { recursive: true });
            }
            await fs.promises.rename(oldFilePath, newFilePath);
          }
        }
      };
      await renameFunc('flac', '_flac', '.flac', 'encoded_flac');
      await renameFunc('wavPack', '_wavPack', '.wv', 'encoded_wavpack');
      await renameFunc('aac', '_aac', '.m4a', 'encoded_aac');
      await renameFunc('opus', '_opus', '.opus', 'encoded_opus');
    }
  })();

  if (argvUtils.getArgv()['save-metadata'] === true) {
    await (async () => {
      await fs.promises.rename(path.join(oldOutputDirPath, 'meta.yaml'), path.join(newOutputDirPathRoot, 'meta.yaml'));
      await fs.promises.rename(
        path.join(oldOutputDirPath, 'meta_hashes.tsv'),
        path.join(newOutputDirPathRoot, 'meta_hashes.tsv'),
      );
      for (const coverImgEntry of Object.entries(workApiRsp.coverImgBuffer)) {
        if (coverImgEntry[1] !== null) {
          await fs.promises.rename(
            path.join(oldOutputDirPath, 'meta_cover_' + coverImgEntry[0] + '.jpg'),
            path.join(newOutputDirPathRoot, 'meta_cover_' + coverImgEntry[0] + '.jpg'),
          );
        }
      }
    })();
  }

  spinner?.stop();
  logger.info('All file deobfuscated');
}

export default {
  calculateHashes,
  deobfuscateFilename,
};
