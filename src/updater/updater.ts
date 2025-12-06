import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import ky from 'ky';
import ora from 'ora';
import prompts from 'prompts';
import { rimraf } from 'rimraf';
import semver from 'semver';
import type * as GitHubApiRel from '../types/GitHubApiRel.js';
import apiUtils from '../utils/api.js';
import argvUtils from '../utils/argv.js';
import configEmbed from '../utils/configEmbed.js';
import exitUtils from '../utils/exit.js';
import logger from '../utils/logger.js';

function isInstalledViaInstaller(): boolean {
  if (process.platform !== 'win32') return false;

  const appId = '{B0B8B114-AE98-4165-BFC7-E029C1DB80D4}_is1';
  const regKeys = [
    `HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appId}`,
    `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appId}`,
    `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${appId}`,
  ];

  for (const key of regKeys) {
    const result = spawnSync('reg', ['query', key], { stdio: 'ignore' });
    if (result.status === 0) return true;
  }

  return false;
}

async function checkAppUpdate(): Promise<void> {
  // const testMode: boolean = false;
  // if (testMode) logger.warn('Update checker test mode is true!');
  if (isInstalledViaInstaller() === false) return;
  await cleanupInstaller();
  const githubApiUrl: string = 'https://api.github.com/repos/daydreamer-json/asmr-dl-ng/releases/latest';
  const githubApiRsp: GitHubApiRel.Release | null = await (async () => {
    try {
      return await ky.get(githubApiUrl, apiUtils.defaultKySettings).json();
    } catch (error) {
      logger.error('Failed to check for updates');
      return null;
    }
  })();
  if (githubApiRsp === null) return;
  const latestVersion = semver.clean(githubApiRsp.tag_name);
  const currentVersion = configEmbed.VERSION_NUMBER;
  if (latestVersion === null) throw new Error('Failed to get latest update');
  if (currentVersion === null) throw new Error('Embed app version number is null');
  if (semver.gt(latestVersion, currentVersion) === false) {
    logger.info(`App is up to date (local: ${chalk.green(currentVersion)}, remote: ${chalk.green(latestVersion)})`);
    return;
  }

  logger.info(`Update is available (local: ${chalk.red(currentVersion)}, remote: ${chalk.green(latestVersion)})`);
  const userSelectRsp: boolean = (
    await prompts(
      {
        name: 'value',
        type: 'toggle',
        message: 'Download and install updates automatically?',
        initial: true,
        active: 'yes',
        inactive: 'no',
      },
      {
        onCancel: async () => {
          logger.error('Aborted');
          exitUtils.exit(1, null, false);
        },
      },
    )
  ).value;
  if (userSelectRsp === false) return;

  await downloadAndApplyUpdate(githubApiRsp);
}

async function downloadAndApplyUpdate(latestRelInfo: GitHubApiRel.Release): Promise<void> {
  if (!(process.platform === 'win32' && process.arch === 'x64')) {
    throw new Error(`This environment is not supported: ${process.platform}, ${process.arch}`);
  }

  const assetNamePattern = /asmr-dl-ng_win_x64_.+?_setup\.exe/g;
  const githubAsset = latestRelInfo.assets.find((e) => assetNamePattern.test(e.name));
  if (!githubAsset) throw new Error('No update asset found');

  const spinner = !argvUtils.getArgv()['no-show-progress']
    ? ora({ text: 'Downloading installer ...', color: 'cyan', spinner: 'dotsCircle' }).start()
    : logger.info('Downloading installer ...');
  const assetBuffer = await ky.get(githubAsset.browser_download_url).bytes();
  const installerPath = path.join(os.tmpdir(), 'asmr-dl-ng_win_x64_setup.exe');
  await fs.writeFile(installerPath, assetBuffer);
  spinner?.stop();

  logger.info('Starting installer and exiting application ...');

  const child = spawn(installerPath, ['/silent', '/norestart'], {
    detached: true,
    stdio: 'ignore',
    shell: true,
  });

  child.unref();

  logger.info('Please restart the app after installation is complete');

  await exitUtils.exit(0, null, false);
}

async function cleanupInstaller(): Promise<void> {
  const installerPath = path.join(os.tmpdir(), 'asmr-dl-ng_win_x64_setup.exe');
  await rimraf(installerPath);
}

export default {
  checkAppUpdate,
};
