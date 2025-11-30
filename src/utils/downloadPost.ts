import crypto from 'node:crypto';
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

  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));
  const results: {
    path: string[];
    uuid: string;
    hash: Record<'sha256' | 'sha384' | 'sha512' | 'sha3-512', string>;
  }[] = [];

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
      const fileStream = fs.createReadStream(filePath);

      let finishDataSize = 0; // bytes
      // const progBarSub = progBar.create(
      //   fileEntry.size,
      //   finishDataSize,
      //   termPrettyUtils.progBarTextFmter.download.sub(finishDataSize, fileEntry.size, fileEntry.path.at(-1) ?? ''),
      //   { format: termPrettyUtils.progBarFmtCfg.download.sub },
      // );
      const progBarUpdateFunc = (_subCurrent: number) => {
        // progBarSub?.update(
        //   subCurrent,
        //   termPrettyUtils.progBarTextFmter.download.sub(subCurrent, fileEntry.size, fileEntry.path.at(-1) ?? ''),
        // );
        const tmpRootPayload = termPrettyUtils.progBarTextFmter.download.root(
          results.length,
          needCalcFileEntry.length,
          finishDataSizeGlobal,
          filesOverallSize,
          rateMeterInstRoot.getRate(),
          argvUtils.getArgv()['thread-hash'],
        );
        progBarRoot?.update(finishDataSizeGlobal, tmpRootPayload);
        progBarTitle?.update(0, tmpRootPayload);
      };

      const hashAlgorithms = ['sha256', 'sha384', 'sha512', 'sha3-512'];
      const hashes: { [key: string]: crypto.Hash } = {};
      hashAlgorithms.forEach((alg) => {
        hashes[alg] = crypto.createHash(alg);
      });

      await new Promise<void>((resolve, reject) => {
        fileStream.on('data', (chunk) => {
          const chunkSize = chunk.length;
          finishDataSize += chunkSize;
          finishDataSizeGlobal += chunkSize;
          rateMeterInstRoot.increment(chunkSize);
          hashAlgorithms.forEach((alg) => hashes[alg]!.update(chunk));
          progBarUpdateFunc(finishDataSize);
        });
        fileStream.on('end', resolve);
        fileStream.on('error', reject);
      });

      const calculatedHashes: { [key: string]: string } = {};
      hashAlgorithms.forEach((alg) => {
        calculatedHashes[alg] = hashes[alg]!.digest('hex');
      });

      results.push({ path: fileEntry.path, uuid: fileEntry.uuid, hash: calculatedHashes as any });

      finishDataSizeGlobal += fileEntry.size - finishDataSize;
      progBarUpdateFunc(fileEntry.size);
      // progBarSub?.stop();
      // progBar?.remove(progBarSub);
    });
  });

  await queue.onIdle();

  progBar?.stop();

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
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
    coverImgBuffer: Record<'main' | 'thumb' | 'icon', ArrayBuffer | null>;
  },
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
          [/<WORK_TITLE>/g, stringUtils.sanitizeFilename(workApiRsp.info.title)],
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

  for (const fileEntry of needProcessFileEntry) {
    const oldFilePath = path.join(oldOutputDirPath, fileEntry.uuid);
    const newFilePath = path.join(newOutputDirPathRoot, ...fileEntry.path.map((e) => stringUtils.sanitizeFilename(e)));
    if ((await fileUtils.checkFolderExists(path.dirname(newFilePath))) === false) {
      await fs.promises.mkdir(path.dirname(newFilePath), { recursive: true });
    }
    await fs.promises.rename(oldFilePath, newFilePath);
  }

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
