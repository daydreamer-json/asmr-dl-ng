import fs from 'node:fs';
import configEmbed from './utils/configEmbed.js';

const packageJsonData = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
packageJsonData.name = configEmbed.APPLICATION_NAME;
packageJsonData.version = configEmbed.VERSION_NUMBER;
fs.writeFileSync('package.json', JSON.stringify(packageJsonData, null, 2), 'utf-8');

fs.writeFileSync(
  'build-rel.bat',
  fs
    .readFileSync('build-rel.bat', 'utf-8')
    .replace(/set VERSION_NUM=.+?\n/, `set VERSION_NUM=${configEmbed.VERSION_NUMBER}\n`),
  'utf-8',
);

fs.writeFileSync(
  'setup/main.iss',
  fs
    .readFileSync('setup/main.iss', 'utf-8')
    .replace(/#define MyAppVersion ".+?"/, `#define MyAppVersion "${configEmbed.VERSION_NUMBER}"`),
  'utf-8',
);
