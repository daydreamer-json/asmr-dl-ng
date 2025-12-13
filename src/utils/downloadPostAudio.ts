// import fs from 'node:fs';
import path from 'node:path';
import cliProgress from 'cli-progress';
import PQueue from 'p-queue';
import * as TypesApiEndpoint from '../types/ApiEndpoint.js';
import * as TypesApiFiles from '../types/ApiFiles.js';
import argvUtils from './argv.js';
import appConfig from './config.js';
import fileUtils from './file.js';
import logger from './logger.js';
// import mathUtils from './math.js';
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

// async function encodeFlac(
//   workApiRsp: {
//     info: TypesApiEndpoint.RspWorkInfoSanitized;
//     fileEntry: {
//       raw: TypesApiFiles.FilesystemEntry[];
//       transformed: TypesApiFiles.FilesystemEntryTransformed[];
//     };
//   },
//   mediaInfoRsp: Awaited<ReturnType<typeof getMediaInfoData>>,
//   selectedFilesUuid: string[],
//   workOverallUuid: string,
// ) {
//   logger.info('Encoding audio in FLAC ...');

//   const queue = new PQueue({ concurrency: argvUtils.getArgv()['thread-convert'] });

//   const needFileEntry: TypesApiFiles.FilesystemEntryTransformed[] = workApiRsp.fileEntry.transformed
//     .toSorted((a, b) => (a.path.join('/') > b.path.join('/') ? 1 : -1))
//     .filter((e) => {

//       if (
//         selectedFilesUuid.includes(e.uuid) &&

//       ) {

//       }
//     });

//   const tempOutputDirPath = path.resolve(path.join(argvUtils.getArgv()['outputDir'], workOverallUuid));

//   const results: {
//     uuid: string;
//     path: string[];
//     result: any;
//   }[] = [];

//   const rateMeterAvgFactor = 2;
//   const rateMeterInstRoot = new rateMeterUtils.RateMeter(1000 * rateMeterAvgFactor, true);
// }

export default { getMediaInfoData };
