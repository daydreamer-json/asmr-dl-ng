import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import stream from 'node:stream';
import util from 'node:util';
import configEmbed from './configEmbed.js';

// import logger from './logger.js';

function getAppDataDir(): string {
  switch (process.platform) {
    case 'win32':
      return path.join(
        process.env['APPDATA'] || path.join(os.homedir(), 'AppData', 'Roaming'),
        configEmbed.APPLICATION_NAME,
      );
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', configEmbed.APPLICATION_NAME);
    case 'linux':
      return path.join(
        process.env['XDG_CONFIG_HOME'] || path.join(os.homedir(), '.config'),
        configEmbed.APPLICATION_NAME,
      );
    default:
      return path.resolve('config');
  }
}

function getDefaultOutputDir(): string {
  const documentsDir = (() => {
    if (process.platform === 'linux' && process.env['XDG_DOCUMENTS_DIR']) {
      return process.env['XDG_DOCUMENTS_DIR'];
    }
    return path.join(os.homedir(), 'Documents');
  })();
  return path.join(documentsDir, configEmbed.APPLICATION_NAME, 'output');
}

async function checkFolderExists(folderPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(folderPath);
    return stats.isDirectory();
  } catch (error: any) {
    return false;
  }
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile();
  } catch (error: any) {
    return false;
  }
}

async function getFileList(dirPath: string): Promise<string[]> {
  const absoluteDirPath = path.resolve(dirPath);
  const filePaths: string[] = [];
  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        filePaths.push(fullPath);
      }
    }
  }
  await walk(absoluteDirPath);
  return filePaths;
}

async function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  const buffer = await fs.promises.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function copyFileWithStream(srcPath: string, destPath: string): Promise<void> {
  const pipelineAsync = util.promisify(stream.pipeline);
  try {
    await pipelineAsync(fs.createReadStream(srcPath), fs.createWriteStream(destPath));
  } catch (err) {
    throw err;
  }
}

export default {
  getAppDataDir,
  getDefaultOutputDir,
  checkFolderExists,
  checkFileExists,
  getFileList,
  readFileAsArrayBuffer,
  copyFileWithStream,
};
