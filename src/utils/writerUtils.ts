import appConfig from './config.js';
import logger from './logger.js';
import argvUtils from './argv.js';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import { encode as cborEncode, decode as cborDecode } from 'cbor2';
import YAML from 'yaml';
import { compress as zstdCompress, decompress as zstdDecompress } from '@mongodb-js/zstd';

async function createDirectory(path: string) {
  await fs.promises.mkdir(path, { recursive: true });
}

function getDirectoryStrFromPath(pathStr: string) {
  return path.dirname(pathStr);
}

async function writeJsonData(data: object | Array<any>, path: string, isMinify: boolean = true) {
  logger.debug('Writing JSON data to file:', path);
  await createDirectory(getDirectoryStrFromPath(path));
  await fs.promises.writeFile(path, isMinify ? JSON.stringify(data) : JSON.stringify(data, null, '  '), {
    flag: 'w',
    encoding: 'utf8',
  });
}

async function writeCborData(data: object | Array<any>, path: string) {
  logger.debug('Writing CBOR data to file:', path);
  await createDirectory(getDirectoryStrFromPath(path));
  await fs.promises.writeFile(path, cborEncode(data), { flag: 'w', encoding: 'binary' });
}

async function writeYamlData(data: object | Array<any>, path: string) {
  logger.debug('Writing YAML data to file:', path);
  await createDirectory(getDirectoryStrFromPath(path));
  await fs.promises.writeFile(path, YAML.stringify(data), { flag: 'w', encoding: 'utf8' });
}

async function writeZstdData(data: Buffer, path: string, compressionLevel: number = 16) {
  logger.debug('Writing ZStd data to file:', path);
  await createDirectory(getDirectoryStrFromPath(path));
  await fs.promises.writeFile(path, await zstdCompress(data, compressionLevel), { flag: 'w', encoding: 'binary' });
}

async function writeJsonlData(data: Array<any>, path: string) {
  const outputTextArray = new Array();
  if (Array.isArray(data)) {
    logger.debug('Writing JSONL data to file:', path);
    const progressBar =
      argvUtils.getArgv().noShowProgress === false
        ? new cliProgress.SingleBar({
            format: 'Writing {bar} {percentage}% | {value}/{total} lines | {duration_formatted}/{eta_formatted}',
            ...appConfig.logger.progressBarConfig,
          })
        : null;
    progressBar !== null ? progressBar.start(data.length, 0) : null;
    data.forEach((obj) => {
      outputTextArray.push(JSON.stringify(obj));
      progressBar !== null ? progressBar.increment(1) : null;
    });
    progressBar !== null ? progressBar.stop() : null;
    await createDirectory(getDirectoryStrFromPath(path));
    await fs.promises.writeFile(path, outputTextArray.join('\n'), { flag: 'w', encoding: 'utf8' });
  } else {
    throw new Error('Data is not an array');
  }
}

async function readJsonlData(path: string | null = null, buffer: Buffer | null) {
  if (path !== null) {
    logger.debug('Reading JSONL data from file:', path);
    const inputText = await fs.promises.readFile(path, { encoding: 'utf8' });
    const outputArray = new Array();
    inputText.split('\n').forEach((line) => {
      if (line.length > 0) {
        outputArray.push(JSON.parse(line));
      }
    });
    return outputArray;
  } else if (buffer) {
    const inputText = buffer.toString('utf8');
    const outputArray = new Array();
    inputText.split('\n').forEach((line) => {
      if (line.length > 0) {
        outputArray.push(JSON.parse(line));
      }
    });
    return outputArray;
  }
}

async function readZstdData(path: string) {
  logger.debug('Reading ZStd data from file:', path);
  return await zstdDecompress(await fs.promises.readFile(path));
}

export default {
  writeJsonData,
  writeCborData,
  writeYamlData,
  writeZstdData,
  writeJsonlData,
  readJsonlData,
  readZstdData,
};
