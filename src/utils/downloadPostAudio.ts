// import fs from 'node:fs';
import path from 'node:path';
import cliProgress from 'cli-progress';
import PQueue from 'p-queue';
import * as TypesApiEndpoint from '../types/ApiEndpoint.js';
import * as TypesApiFiles from '../types/ApiFiles.js';
import argvUtils from './argv.js';
import appConfig from './config.js';
import configUser from './configUser.js';
import fileUtils from './file.js';
import logger from './logger.js';
import mathUtils from './math.js';
import rateMeterUtils from './rateMeter.js';
// import stringUtils from './string.js';
import subProcessAudioUtils from './subProcessAudio.js';
import termPrettyUtils from './termPretty.js';

async function getMediaInfoData(
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
  logger.info('Fetching MediaInfo data ...');

  const queue = new PQueue({ concurrency: argvUtils.getArgv()['thread-convert'] });

  const needFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .filter((e) => selectedFilesUuid.includes(e.uuid));

  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));

  const results: {
    uuid: string;
    path: string[];
    result: any;
  }[] = [];

  const rateMeterAvgFactor = 2;
  const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);

  const progBar = !argvUtils.getArgv()['no-show-progress']
    ? new cliProgress.MultiBar(appConfig.logger.progressBarConfig)
    : undefined;
  const progBarRootPayload = termPrettyUtils.progBarTextFmter.download.root(
    results.length,
    needFileEntry.length,
    results.length,
    needFileEntry.length,
    rateMeterInstRoot.getRate(),
    argvUtils.getArgv()['thread-convert'],
  );
  const progBarTitle = progBar?.create(needFileEntry.length, results.length, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.encoding.mediaInfo.title,
  });
  const progBarRoot = progBar?.create(needFileEntry.length, results.length, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.encoding.mediaInfo.root,
  });

  needFileEntry.forEach((fileEntry) => {
    queue.add(async () => {
      const filePath = path.join(tempOutputDirPath, fileEntry.uuid);
      const rsp = await subProcessAudioUtils.spawnMediaInfo(
        path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
        filePath,
      );
      if (rsp.track[0].Format) {
        results.push({
          uuid: fileEntry.uuid,
          path: fileEntry.path,
          result: rsp,
        });
      }
      const tmpRootPayload = termPrettyUtils.progBarTextFmter.download.root(
        results.length,
        needFileEntry.length,
        results.length,
        needFileEntry.length,
        rateMeterInstRoot.getRate(),
        argvUtils.getArgv()['thread-convert'],
      );
      progBarRoot?.update(results.length, tmpRootPayload);
      progBarTitle?.update(results.length, tmpRootPayload);
    });
  });
  await queue.onIdle();

  progBar?.stop();

  return results
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .map((e) => ({ uuid: e.uuid, result: e.result }));
}

async function encodeFlac(
  workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
  },
  mediaInfoRsp: Awaited<ReturnType<typeof getMediaInfoData>>,
  selectedFilesUuid: string[],
  workOverallUuid: string,
) {
  if (configUser.getConfig().media.encoder.flac === false) return [];

  logger.info('Encoding audio in FLAC ...');

  const queue = new PQueue({ concurrency: argvUtils.getArgv()['thread-convert'] });

  const needFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .filter((e) => {
      if (mediaInfoRsp.map((f) => f.uuid).includes(e.uuid) === false) return false;
      const mediaInfoResult = mediaInfoRsp.find((f) => f.uuid === e.uuid)!.result;
      return Boolean(
        selectedFilesUuid.includes(e.uuid) &&
          mediaInfoResult.track[0]?.Format === 'Wave' &&
          mediaInfoResult.track[1]?.Format === 'PCM' &&
          mediaInfoResult.track[1]?.Format_Profile !== 'Float',
      );
    });
  const filesOverallSize = mathUtils.arrayTotal(needFileEntry.map((e) => e.size));
  let dledDataSizeGlobal: number = 0; // bytes

  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));

  const results: {
    uuid: string;
    path: string[];
    size: number;
    result: any;
  }[] = [];

  const rateMeterAvgFactor = 2;
  const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);

  const progBar = !argvUtils.getArgv()['no-show-progress']
    ? new cliProgress.MultiBar(appConfig.logger.progressBarConfig)
    : undefined;
  const progBarRootPayload = termPrettyUtils.progBarTextFmter.download.root(
    0,
    needFileEntry.length,
    dledDataSizeGlobal,
    filesOverallSize,
    rateMeterInstRoot.getRate(),
    0, // Initial active threads should be 0 as no encode have started yet
  );

  const progBarTitle = progBar?.create(1, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.encoding.flac.title,
  });
  const progBarRoot = progBar?.create(filesOverallSize, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.download.root,
  });

  needFileEntry.forEach((fileEntry) => {
    queue.add(async () => {
      const inFilePath = path.join(tempOutputDirPath, fileEntry.uuid);
      const outFilePath = path.join(tempOutputDirPath, fileEntry.uuid + '_flac');
      let dledDataSize = 0; // bytes
      let lastDledDataSize = 0; // bytes
      const rateMeterFile = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);
      const progBarSub =
        process.stdout.rows > queue.concurrency + 3
          ? progBar?.create(
              fileEntry.size,
              dledDataSize,
              termPrettyUtils.progBarTextFmter.download.sub(
                dledDataSize,
                fileEntry.size,
                rateMeterFile.getRate(),
                fileEntry.path.at(-1) ?? '',
              ),
              { format: termPrettyUtils.progBarFmtCfg.download.sub },
            )
          : undefined;
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
          needFileEntry.length,
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

      await subProcessAudioUtils.spawnFlacEnc(
        path.join(fileUtils.getAppRootDir(), 'bin', 'flac', 'flac.exe'),
        inFilePath,
        outFilePath,
        (progress) => {
          if (progress.type === 'progress') {
            const delta = fileEntry.size * (progress.percentage! / 100) - lastDledDataSize;
            dledDataSize += delta;
            dledDataSizeGlobal += delta;
            rateMeterInstRoot.increment(delta);
            rateMeterFile.increment(delta);
            progBarUpdateFunc(dledDataSize);
            lastDledDataSize = dledDataSize;
          }
        },
      );

      results.push({
        uuid: fileEntry.uuid,
        path: fileEntry.path,
        size: fileEntry.size,
        result: await subProcessAudioUtils.spawnMediaInfo(
          path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
          outFilePath,
        ),
      });

      dledDataSizeGlobal += fileEntry.size - lastDledDataSize;
      rateMeterInstRoot.increment(fileEntry.size - lastDledDataSize);

      progBarSub?.stop();
      progBar?.remove(progBarSub!);
    });
  });

  await queue.onIdle();

  progBar?.stop();

  return results
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .map((e) => ({ uuid: e.uuid, result: e.result }));
}

async function encodeWavPack(
  workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
  },
  mediaInfoRsp: Awaited<ReturnType<typeof getMediaInfoData>>,
  selectedFilesUuid: string[],
  workOverallUuid: string,
) {
  if (configUser.getConfig().media.encoder.wavpack === false) return [];

  logger.info('Encoding audio in WavPack ...');

  const queue = new PQueue({ concurrency: argvUtils.getArgv()['thread-convert'] });

  const needFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .filter((e) => {
      if (mediaInfoRsp.map((f) => f.uuid).includes(e.uuid) === false) return false;
      const mediaInfoResult = mediaInfoRsp.find((f) => f.uuid === e.uuid)!.result;
      return Boolean(
        selectedFilesUuid.includes(e.uuid) &&
          mediaInfoResult.track[0]?.Format === 'Wave' &&
          mediaInfoResult.track[1]?.Format === 'PCM' &&
          mediaInfoResult.track[1]?.Format_Profile === 'Float',
      );
    });
  const filesOverallSize = mathUtils.arrayTotal(needFileEntry.map((e) => e.size));
  let dledDataSizeGlobal: number = 0; // bytes

  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));

  const results: {
    uuid: string;
    path: string[];
    size: number;
    result: any;
  }[] = [];

  const rateMeterAvgFactor = 2;
  const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);

  const progBar = !argvUtils.getArgv()['no-show-progress']
    ? new cliProgress.MultiBar(appConfig.logger.progressBarConfig)
    : undefined;
  const progBarRootPayload = termPrettyUtils.progBarTextFmter.download.root(
    0,
    needFileEntry.length,
    dledDataSizeGlobal,
    filesOverallSize,
    rateMeterInstRoot.getRate(),
    0, // Initial active threads should be 0 as no encode have started yet
  );

  const progBarTitle = progBar?.create(1, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.encoding.wavPack.title,
  });
  const progBarRoot = progBar?.create(filesOverallSize, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.download.root,
  });

  needFileEntry.forEach((fileEntry) => {
    queue.add(async () => {
      const inFilePath = path.join(tempOutputDirPath, fileEntry.uuid);
      const outFilePath = path.join(tempOutputDirPath, fileEntry.uuid + '_wavPack');
      let dledDataSize = 0; // bytes
      let lastDledDataSize = 0; // bytes
      const rateMeterFile = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);
      const progBarSub =
        process.stdout.rows > queue.concurrency + 3
          ? progBar?.create(
              fileEntry.size,
              dledDataSize,
              termPrettyUtils.progBarTextFmter.download.sub(
                dledDataSize,
                fileEntry.size,
                rateMeterFile.getRate(),
                fileEntry.path.at(-1) ?? '',
              ),
              { format: termPrettyUtils.progBarFmtCfg.download.sub },
            )
          : undefined;
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
          needFileEntry.length,
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

      await subProcessAudioUtils.spawnWavPackEnc(
        path.join(fileUtils.getAppRootDir(), 'bin', 'wavpack', 'wavpack.exe'),
        inFilePath,
        outFilePath,
        (progress) => {
          if (progress.type === 'progress') {
            const delta = fileEntry.size * (progress.percentage! / 100) - lastDledDataSize;
            dledDataSize += delta;
            dledDataSizeGlobal += delta;
            rateMeterInstRoot.increment(delta);
            rateMeterFile.increment(delta);
            progBarUpdateFunc(dledDataSize);
            lastDledDataSize = dledDataSize;
          }
        },
      );

      results.push({
        uuid: fileEntry.uuid,
        path: fileEntry.path,
        size: fileEntry.size,
        result: await subProcessAudioUtils.spawnMediaInfo(
          path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
          outFilePath,
        ),
      });

      dledDataSizeGlobal += fileEntry.size - lastDledDataSize;
      rateMeterInstRoot.increment(fileEntry.size - lastDledDataSize);

      progBarSub?.stop();
      progBar?.remove(progBarSub!);
    });
  });

  await queue.onIdle();

  progBar?.stop();

  return results
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .map((e) => ({ uuid: e.uuid, result: e.result }));
}

async function encodeAac(
  workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
  },
  mediaInfoRsp: Awaited<ReturnType<typeof getMediaInfoData>>,
  selectedFilesUuid: string[],
  workOverallUuid: string,
) {
  if (configUser.getConfig().media.encoder.qaac === false) return [];

  logger.info('Encoding audio in AAC ...');

  const queue = new PQueue({ concurrency: argvUtils.getArgv()['thread-convert'] });

  const needFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .filter((e) => {
      if (mediaInfoRsp.map((f) => f.uuid).includes(e.uuid) === false) return false;
      const mediaInfoResult = mediaInfoRsp.find((f) => f.uuid === e.uuid)!.result;
      return Boolean(
        selectedFilesUuid.includes(e.uuid) &&
          (mediaInfoResult.track[1]?.Format === 'PCM' || mediaInfoResult.track[1]?.Format === 'FLAC'),
      );
    });
  const filesOverallSize = mathUtils.arrayTotal(needFileEntry.map((e) => e.size));
  let dledDataSizeGlobal: number = 0; // bytes

  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));

  const results: {
    uuid: string;
    path: string[];
    size: number;
    result: any;
  }[] = [];

  const rateMeterAvgFactor = 2;
  const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);

  const progBar = !argvUtils.getArgv()['no-show-progress']
    ? new cliProgress.MultiBar(appConfig.logger.progressBarConfig)
    : undefined;
  const progBarRootPayload = termPrettyUtils.progBarTextFmter.download.root(
    0,
    needFileEntry.length,
    dledDataSizeGlobal,
    filesOverallSize,
    rateMeterInstRoot.getRate(),
    0, // Initial active threads should be 0 as no encode have started yet
  );

  const progBarTitle = progBar?.create(1, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.encoding.aac.title,
  });
  const progBarRoot = progBar?.create(filesOverallSize, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.download.root,
  });

  needFileEntry.forEach((fileEntry) => {
    queue.add(async () => {
      const inFilePath = path.join(tempOutputDirPath, fileEntry.uuid);
      const outFilePath = path.join(tempOutputDirPath, fileEntry.uuid + '_aac');
      let dledDataSize = 0; // bytes
      let lastDledDataSize = 0; // bytes
      const rateMeterFile = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);
      const progBarSub =
        process.stdout.rows > queue.concurrency + 3
          ? progBar?.create(
              fileEntry.size,
              dledDataSize,
              termPrettyUtils.progBarTextFmter.download.sub(
                dledDataSize,
                fileEntry.size,
                rateMeterFile.getRate(),
                fileEntry.path.at(-1) ?? '',
              ),
              { format: termPrettyUtils.progBarFmtCfg.download.sub },
            )
          : undefined;
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
          needFileEntry.length,
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

      await subProcessAudioUtils.spawnAacEnc(
        path.join(fileUtils.getAppRootDir(), 'bin', 'qaac', 'qaac64.exe'),
        inFilePath,
        outFilePath,
        (progress) => {
          if (progress.type === 'progress') {
            const delta = fileEntry.size * (progress.percentage! / 100) - lastDledDataSize;
            dledDataSize += delta;
            dledDataSizeGlobal += delta;
            rateMeterInstRoot.increment(delta);
            rateMeterFile.increment(delta);
            progBarUpdateFunc(dledDataSize);
            lastDledDataSize = dledDataSize;
          }
        },
      );

      results.push({
        uuid: fileEntry.uuid,
        path: fileEntry.path,
        size: fileEntry.size,
        result: await subProcessAudioUtils.spawnMediaInfo(
          path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
          outFilePath,
        ),
      });

      dledDataSizeGlobal += fileEntry.size - lastDledDataSize;
      rateMeterInstRoot.increment(fileEntry.size - lastDledDataSize);

      progBarSub?.stop();
      progBar?.remove(progBarSub!);
    });
  });

  await queue.onIdle();

  progBar?.stop();

  return results
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .map((e) => ({ uuid: e.uuid, result: e.result }));
}

async function encodeOpus(
  workApiRsp: {
    info: TypesApiEndpoint.RspWorkInfoSanitized;
    fileEntry: {
      raw: TypesApiFiles.FilesystemEntry[];
      transformed: TypesApiFiles.FilesystemEntryTransformed[];
    };
  },
  mediaInfoRsp: Awaited<ReturnType<typeof getMediaInfoData>>,
  selectedFilesUuid: string[],
  workOverallUuid: string,
) {
  if (configUser.getConfig().media.encoder.opus === false) return [];

  logger.info('Encoding audio in Opus ...');

  const queue = new PQueue({ concurrency: argvUtils.getArgv()['thread-convert'] });

  const needFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .filter((e) => {
      if (mediaInfoRsp.map((f) => f.uuid).includes(e.uuid) === false) return false;
      const mediaInfoResult = mediaInfoRsp.find((f) => f.uuid === e.uuid)!.result;
      return Boolean(
        selectedFilesUuid.includes(e.uuid) &&
          (mediaInfoResult.track[1]?.Format === 'PCM' || mediaInfoResult.track[1]?.Format === 'FLAC'),
      );
    });
  const filesOverallSize = mathUtils.arrayTotal(needFileEntry.map((e) => e.size));
  let dledDataSizeGlobal: number = 0; // bytes

  const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));

  const results: {
    uuid: string;
    path: string[];
    size: number;
    result: any;
  }[] = [];

  const rateMeterAvgFactor = 2;
  const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);

  const progBar = !argvUtils.getArgv()['no-show-progress']
    ? new cliProgress.MultiBar(appConfig.logger.progressBarConfig)
    : undefined;
  const progBarRootPayload = termPrettyUtils.progBarTextFmter.download.root(
    0,
    needFileEntry.length,
    dledDataSizeGlobal,
    filesOverallSize,
    rateMeterInstRoot.getRate(),
    0, // Initial active threads should be 0 as no encode have started yet
  );

  const progBarTitle = progBar?.create(1, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.encoding.opus.title,
  });
  const progBarRoot = progBar?.create(filesOverallSize, 0, progBarRootPayload, {
    format: termPrettyUtils.progBarFmtCfg.download.root,
  });

  needFileEntry.forEach((fileEntry) => {
    queue.add(async () => {
      const inFilePath = path.join(tempOutputDirPath, fileEntry.uuid);
      const outFilePath = path.join(tempOutputDirPath, fileEntry.uuid + '_opus');
      let dledDataSize = 0; // bytes
      let lastDledDataSize = 0; // bytes
      const rateMeterFile = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);
      const progBarSub =
        process.stdout.rows > queue.concurrency + 3
          ? progBar?.create(
              fileEntry.size,
              dledDataSize,
              termPrettyUtils.progBarTextFmter.download.sub(
                dledDataSize,
                fileEntry.size,
                rateMeterFile.getRate(),
                fileEntry.path.at(-1) ?? '',
              ),
              { format: termPrettyUtils.progBarFmtCfg.download.sub },
            )
          : undefined;
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
          needFileEntry.length,
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

      await subProcessAudioUtils.spawnOpusEnc(
        path.join(fileUtils.getAppRootDir(), 'bin', 'opus', 'opusenc.exe'),
        inFilePath,
        outFilePath,
        (progress) => {
          if (progress.type === 'progress') {
            const delta = fileEntry.size * (progress.percentage! / 100) - lastDledDataSize;
            dledDataSize += delta;
            dledDataSizeGlobal += delta;
            rateMeterInstRoot.increment(delta);
            rateMeterFile.increment(delta);
            progBarUpdateFunc(dledDataSize);
            lastDledDataSize = dledDataSize;
          }
        },
      );

      results.push({
        uuid: fileEntry.uuid,
        path: fileEntry.path,
        size: fileEntry.size,
        result: await subProcessAudioUtils.spawnMediaInfo(
          path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
          outFilePath,
        ),
      });

      dledDataSizeGlobal += fileEntry.size - lastDledDataSize;
      rateMeterInstRoot.increment(fileEntry.size - lastDledDataSize);

      progBarSub?.stop();
      progBar?.remove(progBarSub!);
    });
  });

  await queue.onIdle();

  progBar?.stop();

  return results
    .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
    .map((e) => ({ uuid: e.uuid, result: e.result }));
}

export default { getMediaInfoData, encodeFlac, encodeWavPack, encodeAac, encodeOpus };
