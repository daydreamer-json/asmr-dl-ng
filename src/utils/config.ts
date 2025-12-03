import fs from 'node:fs/promises';
import path from 'node:path';
import deepmerge from 'deepmerge';
import YAML from 'yaml';
import * as TypesLogLevels from '../types/LogLevels.js';
import fileUtils from './file.js';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<
  Freeze<{
    network: {
      asmrApi: {
        // all values are base64
        baseDomain: {
          latest: string;
          original: string;
          mirror1: string;
          mirror2: string;
          mirror3: string;
        };
        apiPath: string;
        refererUrl: string;
      };
      userAgent: {
        chromeWindows: string;
        curl: string;
        ios: string;
      };
      timeout: number;
      retryCount: number;
    };
    threadCount: {
      network: number;
      hashing: number;
    };
    cli: {
      autoExit: boolean;
    };
    logger: {
      // log4js-node logger settings
      logLevel: TypesLogLevels.LogLevelNumber;
      useCustomLayout: boolean;
      customLayoutPattern: string;
      useBitUnitForSpeed: boolean;
      progressBarConfig: {
        // cli-progress settings
        barCompleteChar: string;
        barIncompleteChar: string;
        hideCursor: boolean;
        barsize: number;
        fps: number;
        clearOnComplete: boolean;
      };
    };
  }>
>;

const initialConfig: ConfigType = {
  network: {
    asmrApi: {
      baseDomain: {
        latest: 'YXBpLmFzbXItMjAwLmNvbQ==',
        original: 'YXBpLmFzbXIub25l',
        mirror1: 'YXBpLmFzbXItMTAwLmNvbQ==',
        mirror2: 'YXBpLmFzbXItMjAwLmNvbQ==',
        mirror3: 'YXBpLmFzbXItMzAwLmNvbQ==',
      },
      apiPath: 'YXBp',
      refererUrl: 'aHR0cHM6Ly9hc21yLm9uZS8=',
    },
    userAgent: {
      chromeWindows:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      curl: 'curl/8.13.0',
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/143.0.7499.38 Mobile/15E148 Safari/604.1',
    },
    timeout: 20000,
    retryCount: 5,
  },
  threadCount: {
    network: 8,
    hashing: 16,
  },
  cli: {
    autoExit: false,
  },
  logger: {
    logLevel: 5,
    useCustomLayout: true,
    customLayoutPattern: '%[%d{hh:mm:ss.SSS} %-5.0p >%] %m',
    useBitUnitForSpeed: false,
    progressBarConfig: {
      barCompleteChar: '\u2588',
      barIncompleteChar: ' ',
      hideCursor: false,
      barsize: 30,
      fps: 10,
      clearOnComplete: true,
    },
  },
};

const deobfuscator = (input: ConfigType): ConfigType => {
  const newConfig = JSON.parse(JSON.stringify(input)) as any;
  const asmrApi = newConfig.network.asmrApi;
  for (const key of Object.keys(asmrApi.baseDomain) as (keyof typeof asmrApi.baseDomain)[]) {
    asmrApi.baseDomain[key] = atob(asmrApi.baseDomain[key]);
  }
  asmrApi.apiPath = atob(asmrApi.apiPath);
  asmrApi.refererUrl = atob(asmrApi.refererUrl);
  return newConfig;
};

const filePath = path.join(fileUtils.getAppDataDir(), 'config.yaml');

if ((await fileUtils.checkFileExists(filePath)) === false) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, YAML.stringify(initialConfig, null, 2), 'utf-8');
}

const config: ConfigType = await (async () => {
  const rawFileData: ConfigType = YAML.parse(await fs.readFile(filePath, 'utf-8')) as ConfigType;
  const mergedConfig = deepmerge(initialConfig, rawFileData);
  if (JSON.stringify(rawFileData) !== JSON.stringify(mergedConfig)) {
    await fs.writeFile(filePath, YAML.stringify(mergedConfig, null, 2), 'utf-8');
  }
  return deobfuscator(mergedConfig);
})();

export default config;
