import fs from 'node:fs/promises';
import path from 'node:path';
import deepmerge from 'deepmerge';
import YAML from 'yaml';
import fileUtils from './file.js';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<
  Freeze<{
    file: {
      outputDirPath: string;
      outputDirPattern: string;
      useAutoFilterRegex: boolean;
      filterRegex: {
        include: string[];
        exclude: string[];
      };
    };
  }>
>;

const initialConfig: ConfigType = {
  file: {
    outputDirPath: fileUtils.getDefaultOutputDir(),
    outputDirPattern: '<WORK_ID>_<WORK_TITLE>',
    useAutoFilterRegex: false,
    filterRegex: {
      include: ['^.*$'],
      exclude: ['^.*\.mp3$', '^.*SE(な|無)し.*$'],
    },
  },
};

const filePath = path.join(fileUtils.getAppDataDir(), 'config_user.yaml');

if ((await fileUtils.checkFileExists(filePath)) === false) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, YAML.stringify(initialConfig, null, 2), 'utf-8');
}

let config: ConfigType = await (async () => {
  const rawFileData: ConfigType = YAML.parse(await fs.readFile(filePath, 'utf-8')) as ConfigType;
  const mergedConfig = deepmerge(initialConfig, rawFileData, {
    arrayMerge: (_destinationArray, sourceArray) => sourceArray,
  });
  if (JSON.stringify(rawFileData) !== JSON.stringify(mergedConfig)) {
    await fs.writeFile(filePath, YAML.stringify(mergedConfig, null, 2), 'utf-8');
  }
  return mergedConfig;
})();

export default {
  getConfig: () => config,
  setConfig: async (newValue: ConfigType) => {
    config = newValue;
    await fs.writeFile(filePath, YAML.stringify(config, null, 2), 'utf-8');
  },
};
