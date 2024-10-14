import fs from 'fs';
import { DateTime } from 'luxon';
import * as TypesTrackEntry from '../types/TrackEntry.js';

const initDatabaseData: Array<{
  workInfoPruned: any;
  workFolderStructure: TypesTrackEntry.TypeModifiedTrackEntry[];
  date: string;
}> = [];

const fileExistsCheck = async (path: string) => {
  try {
    await fs.promises.access(path, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
};
if ((await fileExistsCheck('config/database.json')) === false) {
  await fs.promises.writeFile('config/database.json', JSON.stringify(initDatabaseData, null, '  '), {
    encoding: 'utf-8',
  });
}

let database = await (async (): Promise<
  Array<{
    workInfoPruned: any;
    workFolderStructure: TypesTrackEntry.TypeModifiedTrackEntry[];
    date: string;
  }>
> => {
  const tmpObj: Array<{
    workInfoPruned: any;
    workFolderStructure: TypesTrackEntry.TypeModifiedTrackEntry[];
    date: string;
  }> = JSON.parse(await fs.promises.readFile('config/database.json', 'utf-8'));
  return tmpObj;
})();

export default {
  getConfig: () => database,
  setConfig: (
    newValue: Array<{
      workInfoPruned: any;
      workFolderStructure: TypesTrackEntry.TypeModifiedTrackEntry[];
      date: string;
    }>,
  ) => {
    database = newValue;
  },
  writeConfigToFile: async () => {
    await fs.promises.writeFile('config/database.json', JSON.stringify(database, null, '  '), 'utf-8');
  },
};
