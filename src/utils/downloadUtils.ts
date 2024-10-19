import crypto from 'crypto';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';
import retry from 'async-retry';
import axios, { AxiosResponse } from 'axios';
import cliProgress from 'cli-progress';
import { DateTime } from 'luxon';
import * as uuid from 'uuid';
import * as TypesTrackEntry from '../types/TrackEntry.js';
import apiConnectModule from './apiConnect.js';
import apiDefsModule from './apiDefs.js';
import argvUtils from './argv.js';
import appConfig from './config.js';
import appConfigDatabase from './configDatabase.js';
import httpErrorCodeDefs from './httpErrorCodeDefs.js';
import logger from './logger.js';
import markdownUtils from './markdownUtils.js';
import mathUtils from './mathUtils.js';
import stringUtils from './stringUtils.js';
import waitUtils from './waitUtils.js';

async function healthCheck() {
  logger.debug('Checking API health ...');
  const apiDef = apiDefsModule.apiDefs.health();
  const apiRsp = await apiConnectModule.apiConnect(apiDef.endpoint, apiDef.params);
  if (apiRsp === 'OK') {
    return true;
  } else {
    throw new Error('API health check failed');
  }
}

async function singleDownload(workId: number) {
  await new Promise<void>(async (resolve) => {
    await healthCheck();
    logger.info('Downloading work:', workId, '...');
    const apiDef = {
      workInfoPruned: apiDefsModule.apiDefs.workInfo(workId),
      workFolderStructure: apiDefsModule.apiDefs.workFolderStructure(workId),
    };
    logger.debug('Connecting to API ...');
    const apiRsp: {
      workInfoPruned: any;
      workFolderStructure: any;
    } = {
      workInfoPruned: null,
      workFolderStructure: null,
    };
    try {
      apiRsp.workInfoPruned = await apiConnectModule.apiConnect(
        apiDef.workInfoPruned.endpoint,
        apiDef.workInfoPruned.params,
      );
    } catch (error: any) {
      logger.error('Work info API error has occured');
      if (error.status) {
        logger.error(`${error.code}, HTTP ${error.status} ${httpErrorCodeDefs[`${error.status}`].message}`);
        process.exit(1);
      } else {
        throw error;
      }
    }
    try {
      apiRsp.workFolderStructure = await apiConnectModule.apiConnect(
        apiDef.workFolderStructure.endpoint,
        apiDef.workFolderStructure.params,
      );
    } catch (error) {
      logger.warn('File structure not found. Skipped');
      return resolve();
    }
    const modifiedWorkFolderStructureJson = modifyWorkFolderStructureJson(apiRsp.workFolderStructure, '');
    const optimizedWorkFolderStructureJson = optimizeWorkFolderStructureJson(modifiedWorkFolderStructureJson, '');
    let tmp_threadId = 0;
    const optimizedWFSThreaded: Array<TypesTrackEntry.TypeOptimizedTrackEntry & { threadId: number }> = new Array();
    for (let i = 0; i < optimizedWorkFolderStructureJson.length; i++) {
      optimizedWFSThreaded.push({
        threadId: tmp_threadId,
        ...optimizedWorkFolderStructureJson[i],
      });
      tmp_threadId === argvUtils.getArgv().thread - 1 ? (tmp_threadId = 0) : (tmp_threadId += 1);
    }
    const optimizedWFSChunked: Array<Array<TypesTrackEntry.TypeOptimizedTrackEntry & { threadId: number }>> =
      new Array();
    Array.from(new Set(optimizedWFSThreaded.map((obj) => obj.threadId))).forEach((threadId) => {
      optimizedWFSChunked.push(optimizedWFSThreaded.filter((obj) => obj.threadId === threadId));
    });
    const progressBar =
      argvUtils.getArgv().noShowProgress === false
        ? new cliProgress.MultiBar({
            format: 'Downloading {bar} {percentage}% | {value}/{total} files | {duration_formatted}/{eta_formatted}',
            ...appConfig.logger.progressBarConfig,
          })
        : null;
    const subOverallProgressBar =
      progressBar !== null
        ? progressBar.create(optimizedWorkFolderStructureJson.length, 0, null, {
            format: '{bar} {percentage}% | {value}/{total} files | {duration_formatted}/{eta_formatted}',
          })
        : null;

    let activeDownloadsCount = 0;
    const downloadedFileEntry: Array<TypesTrackEntry.TypeOptimizedTrackEntry> = new Array();
    const downloadEmitter = new EventEmitter();
    const waitForAvailableThread = async () => {
      if (activeDownloadsCount < argvUtils.getArgv().thread) {
        return;
      }
      await new Promise((resolve) => {
        downloadEmitter.once('threadAvailable', resolve);
      });
    };
    await fs.promises.rm(path.join(argvUtils.getArgv().outputDir, stringUtils.numberToRJIdString(workId)), {
      recursive: true,
      force: true,
    });
    for (let i = 0; i < optimizedWorkFolderStructureJson.length; i++) {
      const entryObj = optimizedWorkFolderStructureJson[i];
      await waitForAvailableThread();
      activeDownloadsCount++;
      const connectionTimeStart = process.hrtime();
      (async () => {
        const headRsp: AxiosResponse = await (async () => {
          return await retry(
            async () => {
              return await axios({
                method: 'head',
                url: entryObj.url,
                headers: { ...apiDefsModule.defaultApiConnectionHeader },
                timeout: appConfig.network.timeout,
              });
            },
            {
              retries: 10,
              factor: 2,
              minTimeout: 500,
              maxTimeout: Infinity,
              onRetry: (error: any, num) => {},
            },
          );
        })();
        const progressTextFormatter = (currentValue: number, totalValue: number) => {
          return {
            percentageFormatted:
              currentValue > totalValue
                ? '100.00'
                : mathUtils.rounder('ceil', (currentValue / totalValue) * 100, 2).padded.padStart(6, ' '),
            valueFormatted: mathUtils.formatFileSizeFixedUnit(currentValue, 'MiB', 2).padStart(11, ' '),
            totalFormatted: mathUtils.formatFileSizeFixedUnit(totalValue, 'MiB', 2).padStart(11, ' '),
          };
        };
        await fs.promises.mkdir(
          path.dirname(path.join(argvUtils.getArgv().outputDir, stringUtils.numberToRJIdString(workId), entryObj.path)),
          {
            recursive: true,
          },
        );
        // await fs.promises.mkdir(argvUtils.getArgv().outputDir, {
        //   recursive: true,
        // });
        const writer = fs.createWriteStream(
          path.join(argvUtils.getArgv().outputDir, stringUtils.numberToRJIdString(workId), entryObj.path),
        );
        // const writer = fs.createWriteStream(
        //   path.join(argvUtils.getArgv().outputDir, entryObj.uuid + path.extname(entryObj.path)),
        // );
        let downloadedLength = 0;
        let subProgressBar =
          progressBar !== null
            ? progressBar.create(
                headRsp.headers['content-length'] ? parseInt(headRsp.headers['content-length']) : 1,
                downloadedLength,
                {
                  title: path.basename(entryObj.path),
                  ...progressTextFormatter(
                    downloadedLength,
                    headRsp.headers['content-length'] ? parseInt(headRsp.headers['content-length']) : 0,
                  ),
                },
                {
                  format: '{bar} {percentageFormatted}% | {valueFormatted} / {totalFormatted} | {title}',
                },
              )
            : null;
        const response: AxiosResponse = await (async () => {
          return await retry(
            async () => {
              return await axios({
                method: 'get',
                url: entryObj.url,
                headers: { ...apiDefsModule.defaultApiConnectionHeader },
                timeout: appConfig.network.timeout,
                responseType: 'stream',
              });
            },
            {
              retries: 10,
              factor: 2,
              minTimeout: 500,
              maxTimeout: Infinity,
              onRetry: (error: any, num) => {},
            },
          );
        })();
        response.data.on('data', (chunk: any) => {
          downloadedLength += chunk.length;
          subProgressBar !== null ? subProgressBar.increment(chunk.length) : null;
          subProgressBar !== null
            ? subProgressBar.update(downloadedLength, {
                title: path.basename(entryObj.path),
                ...progressTextFormatter(
                  downloadedLength,
                  headRsp.headers['content-length'] ? parseInt(headRsp.headers['content-length']) : 0,
                ),
              })
            : null;
        });
        response.data.pipe(writer);
        response.data.on('end', () => {
          subProgressBar !== null ? subProgressBar.stop() : null;
        });
        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => {
            subProgressBar !== null && progressBar !== null
              ? progressBar.remove(subProgressBar)
              : logger.debug(`Downloaded: ${entryObj.uuid}${path.extname(entryObj.path)}`);
            resolve();
          });
          writer.on('error', reject);
        });
        subOverallProgressBar !== null ? subOverallProgressBar.increment() : null;
      })().then(async () => {
        downloadedFileEntry.push(entryObj);
        activeDownloadsCount--;
        if (activeDownloadsCount < argvUtils.getArgv().thread) {
          downloadEmitter.emit('threadAvailable');
        }
        if (downloadedFileEntry.length === optimizedWorkFolderStructureJson.length) {
          await afterAllDownloadedFunc();
        }
      });
    }

    const afterAllDownloadedFunc = async () => {
      progressBar !== null ? progressBar.stop() : null;
      logger.debug('Downloading cover image ...');
      type coverRspTempType = {
        main: AxiosResponse | null;
        small: AxiosResponse | null;
        thumb: AxiosResponse | null;
      };
      const coverRsp: coverRspTempType = {
        main: null,
        small: null,
        thumb: null,
      };
      const isCoverAvailable = {
        main: false,
        small: false,
        thumb: false,
      };
      try {
        coverRsp.main = await axios({
          method: 'get',
          url: apiDefsModule.apiDefs.coverImage(workId, 'main').endpoint,
          params: apiDefsModule.apiDefs.coverImage(workId, 'main').params,
          headers: { ...apiDefsModule.defaultApiConnectionHeader },
          timeout: appConfig.network.timeout,
          responseType: 'arraybuffer',
        });
        if (coverRsp.main) {
          await fs.promises.writeFile(
            path.join(argvUtils.getArgv().outputDir, stringUtils.numberToRJIdString(workId), 'cover_main.jpg'),
            coverRsp.main.data,
            {
              flag: 'w',
            },
          );
          isCoverAvailable.main = true;
        }
      } catch (error: any) {
        if (error.status && error.status === 404) {
        } else if (error.message.includes('maxContentLength size of -1 exceeded')) {
        } else {
          throw error;
        }
      }
      try {
        coverRsp.small = await axios({
          method: 'get',
          url: apiDefsModule.apiDefs.coverImage(workId, '240x240').endpoint,
          params: apiDefsModule.apiDefs.coverImage(workId, '240x240').params,
          headers: { ...apiDefsModule.defaultApiConnectionHeader },
          timeout: appConfig.network.timeout,
          responseType: 'arraybuffer',
        });
        if (coverRsp.small) {
          await fs.promises.writeFile(
            path.join(argvUtils.getArgv().outputDir, stringUtils.numberToRJIdString(workId), 'cover_small.jpg'),
            coverRsp.small.data,
            {
              flag: 'w',
            },
          );
          isCoverAvailable.small = true;
        }
      } catch (error: any) {
        if (error.status && error.status === 404) {
        } else if (error.message.includes('maxContentLength size of -1 exceeded')) {
        } else {
          throw error;
        }
      }
      try {
        coverRsp.thumb = await axios({
          method: 'get',
          url: apiDefsModule.apiDefs.coverImage(workId, 'sam').endpoint,
          params: apiDefsModule.apiDefs.coverImage(workId, 'sam').params,
          headers: { ...apiDefsModule.defaultApiConnectionHeader },
          timeout: appConfig.network.timeout,
          responseType: 'arraybuffer',
        });
        if (coverRsp.thumb) {
          await fs.promises.writeFile(
            path.join(argvUtils.getArgv().outputDir, stringUtils.numberToRJIdString(workId), 'cover_thumb.jpg'),
            coverRsp.thumb.data,
            { flag: 'w' },
          );
          isCoverAvailable.thumb = true;
        }
      } catch (error: any) {
        if (error.status && error.status === 404) {
        } else if (error.message.includes('maxContentLength size of -1 exceeded')) {
        } else {
          throw error;
        }
      }
      logger.info('Download completed:', workId);
      if (argvUtils.getArgv().saveMetadata === true) {
        logger.debug('Writing metadata json ...');
        const metadataJson = {
          workInfoPruned: apiRsp.workInfoPruned,
          workFolderStructure: modifiedWorkFolderStructureJson,
          date: DateTime.now().toISO(),
        };
        await fs.promises.writeFile(
          path.join(argvUtils.getArgv().outputDir, stringUtils.numberToRJIdString(workId), 'metadata.json'),
          JSON.stringify(metadataJson, null, '  '),
          { flag: 'w', encoding: 'utf8' },
        );
      }
      resolve();
    };
  });
}

function modifyWorkFolderStructureJson(
  data: Array<TypesTrackEntry.TypeOriginalTrackEntry>,
  parentPath: string = '',
): Array<TypesTrackEntry.TypeModifiedTrackEntry> {
  return data.map((item) => {
    const currentPath = parentPath ? path.join(parentPath, item.title) : item.title;
    const newItem: TypesTrackEntry.TypeModifiedTrackEntry = {
      uuid: uuid.v7(),
      path: currentPath,
      ...item,
      children: item.children ? modifyWorkFolderStructureJson(item.children, currentPath) : null,
    };
    return newItem;
  });
}

function optimizeWorkFolderStructureJson(data: Array<TypesTrackEntry.TypeModifiedTrackEntry>, pathString: string = '') {
  let downloadTrackListArray: Array<TypesTrackEntry.TypeOptimizedTrackEntry> = [];
  for (let i = 0; i < data.length; i++) {
    if (data[i].type === 'folder' && data[i].children && data[i].children !== null) {
      downloadTrackListArray = downloadTrackListArray.concat(
        optimizeWorkFolderStructureJson(data[i].children || [], path.join(pathString, data[i].title)),
      );
    } else {
      downloadTrackListArray.push({
        uuid: data[i].uuid,
        path: path.join(pathString, data[i].title),
        url: data[i].mediaDownloadUrl,
        hash: data[i].hash,
      });
    }
  }
  return downloadTrackListArray;
}

function fixFilenameOnWindows(str: string, forceUnderscore: boolean = false) {
  const pattern = /[\\\/:\*\?\"<>\|]/g;
  if (forceUnderscore === true) {
    return str.replace(pattern, '_');
  } else {
    return str
      .replaceAll('\\', '＼')
      .replaceAll('/', '／')
      .replaceAll(':', '：')
      .replaceAll('*', '＊')
      .replaceAll('?', '？')
      .replaceAll('"', '＂')
      .replaceAll('<', '＜')
      .replaceAll('>', '＞')
      .replaceAll('|', '｜');
  }
}

export default {
  healthCheck,
  singleDownload,
};
