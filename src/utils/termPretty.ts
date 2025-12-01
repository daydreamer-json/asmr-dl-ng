import chalk from 'chalk';
import CliTable3 from 'cli-table3';
import { DateTime, Duration } from 'luxon';
import terminalLink from 'terminal-link';
import * as TypesApiEndpoint from '../types/ApiEndpoint.js';
import * as TypesApiFiles from '../types/ApiFiles.js';
import appConfig from './config.js';
import mathUtils from './math.js';
import stringUtils from './string.js';

const cliTableConfig = {
  rounded: {
    chars: {
      top: '─',
      'top-mid': '',
      'top-left': '╭',
      'top-right': '╮',
      bottom: '─',
      'bottom-mid': '',
      'bottom-left': '╰',
      'bottom-right': '╯',
      left: '│',
      'left-mid': '├',
      mid: '─',
      'mid-mid': '',
      right: '│',
      'right-mid': '┤',
      middle: '',
    },
    style: { 'padding-left': 1, 'padding-right': 1, head: [''], border: [''], compact: true },
  },
};

const blockElementChar = {
  block: {
    full: '\u2588', // FULL BLOCK
    notFull: [
      '\u258f', // LEFT ONE EIGHTH BLOCK
      '\u258e', // LEFT ONE QUARTER BLOCK
      '\u258d', // LEFT THREE EIGHTHS BLOCK
      '\u258c', // LEFT HALF BLOCK
      '\u258b', // LEFT FIVE EIGHTHS BLOCK
      '\u258a', // LEFT THREE QUARTERS BLOCK
      '\u2589', // LEFT SEVEN EIGHTHS BLOCK
    ],
  },
  shade: ['\u2591', '\u2592', '\u2593'], // LIGHT, MEDIUM, DARK SHADE
};

const fmtFileSizeDefaultCfg = {
  decimals: 2,
  decimalPadding: true,
  unitVisible: false,
  useBinaryUnit: true,
  useBitUnit: false,
  unit: 'M',
} as const;

function printWorkInfo(workApiRsp: {
  info: TypesApiEndpoint.RspWorkInfoSanitized;
  fileEntry: {
    raw: TypesApiFiles.FilesystemEntry[];
    transformed: TypesApiFiles.FilesystemEntryTransformed[];
  };
}): string {
  const table = new CliTable3(cliTableConfig.rounded);
  table.push(
    ...[
      ['ID', terminalLink(workApiRsp.info.source_id, workApiRsp.info.source_url, { fallback: false })],
      ['Title', workApiRsp.info.title],
      // ['Circle ID', workApiRsp.info.circle.source_id],
      [
        'Circle Name',
        terminalLink(
          workApiRsp.info.circle.name,
          `https://www.dlsite.com/maniax/circle/profile/=/maker_id/${workApiRsp.info.circle.source_id}.html`,
          { fallback: false },
        ),
      ],
      [
        'VA Name',
        workApiRsp.info.vas
          .map((e) => e.name)
          .join(', ')
          .replace(/^N\/A$/g, chalk.dim('(none)')),
      ],
      ['Release Date', DateTime.fromISO(workApiRsp.info.release).toFormat('yyyy/MM/dd')],
      ['Created Date', DateTime.fromISO(workApiRsp.info.create_date).toFormat('yyyy/MM/dd')],
      [
        'Age Category',
        stringUtils.replaceMultiPatterns(
          [
            [/^general/g, 'G (Safe)'],
            [/^r15/g, 'R15 (Sensitive)'],
            [/^adult/g, 'R18 (Explicit)'],
          ],
          workApiRsp.info.age_category_string,
        ),
      ],
      ['DL Count', workApiRsp.info.dl_count.toLocaleString()],
      ['Price', workApiRsp.info.price.toLocaleString() + ' JPY'],
      [
        'Total size',
        mathUtils.formatFileSize(
          mathUtils.arrayTotal(workApiRsp.fileEntry.transformed.map((e) => e.size)),
          fmtFileSizeDefaultCfg,
        ) + ' MiB',
      ],
    ].map((e) => [chalk.dim(e[0]), e[1]]),
  );
  return table.toString();
}

/**
 * Generates the fancy text for the bar portion of the progress bar.
 * @param current current value
 * @param total maximum value
 * @param width bar width character count
 * @param useShade Use SHADE block in blank area
 * @returns Generated progress bar text
 */
function generateProgBarBox(current: number, total: number, width: number, useShade: boolean = false): string {
  if (width <= 0) return '';

  // normalize current and total
  const clampedCurrent = Math.max(0, Math.min(current, total));
  const validTotal = Math.max(1, total);

  // total segments (1 char = 8 segments)
  const totalSegments = width * 8;

  // calc num of segments to fill (round to the nearest int)
  const ratio = clampedCurrent / validTotal;
  const filledSegments = Math.round(ratio * totalSegments);

  // segment count clamping (restricting to the range 0 to totalSegments)
  const clampedSegments = Math.max(0, Math.min(filledSegments, totalSegments));

  // calc num of complete blocks and the remaining segments
  const fullBlocks = Math.floor(clampedSegments / 8);
  const remainder = clampedSegments % 8;

  // fraction block mapping (corresponding to 1-7)
  const fractionalBlocks = ['', ...blockElementChar.block.notFull];

  // add full blocks
  let bar = blockElementChar.block.full.repeat(fullBlocks);

  // add fraction blocks (if necessary)
  if (remainder > 0) {
    bar += fractionalBlocks[remainder];
  }

  // calc num of used char
  const usedChars = fullBlocks + (remainder > 0 ? 1 : 0);
  const remainingChars = width - usedChars;

  // generate empty area (LIGHT SHADE or space)
  const emptyChar = useShade ? '\u2591' : ' ';
  bar += emptyChar.repeat(remainingChars);

  return bar;
}

function detectUseFancyProgBarBox(): Record<'fancy' | 'shade', boolean> {
  return {
    fancy:
      [' ', ...blockElementChar.shade].includes(appConfig.logger.progressBarConfig.barIncompleteChar) &&
      [blockElementChar.block.full, ...blockElementChar.block.notFull].includes(
        appConfig.logger.progressBarConfig.barCompleteChar,
      ),
    shade: blockElementChar.shade.includes(appConfig.logger.progressBarConfig.barIncompleteChar),
  };
}

const getFmtTimeRemaining = (seconds: number): string => {
  seconds = Math.ceil(seconds);
  if (seconds >= 86400) return '--:--:--';
  const parsed = Duration.fromObject({ seconds });
  if (seconds >= 3600) return parsed.toFormat('HH:mm:ss');
  if (seconds >= 60) return parsed.toFormat('mm:ss');
  return String(seconds) + ' sec';
};

export default {
  cliTableConfig,
  printWorkInfo,
  detectUseFancyProgBarBox,
  progBarTextFmter: {
    download: {
      root: (
        cur: number,
        max: number,
        curBytes: number,
        maxBytes: number,
        speedBytes: number,
        threads: string | number,
      ) => {
        const fmtVB = mathUtils.formatFileSize(curBytes, fmtFileSizeDefaultCfg);
        const fmtTB = mathUtils.formatFileSize(maxBytes, fmtFileSizeDefaultCfg);
        return {
          fmtBar: generateProgBarBox(
            curBytes,
            maxBytes,
            appConfig.logger.progressBarConfig.barsize,
            detectUseFancyProgBarBox().shade,
          ),
          fmtPct: mathUtils.rounder('ceil', (curBytes / maxBytes) * 100, 2).padded.padStart(6, ' '),
          fmtValueBytes: fmtVB.padStart(fmtTB.length, ' '),
          fmtTotalBytes: fmtTB.padStart(fmtTB.length, ' '),
          fmtValueFileCount: String(cur).padStart(String(max).length, ' '),
          fmtTotalFileCount: String(max).padStart(String(max).length, ' '),
          fmtSpeed: mathUtils.formatFileSize(speedBytes, {
            ...fmtFileSizeDefaultCfg,
            useBitUnit: appConfig.logger.useBitUnitForSpeed,
          }),
          fmtTimeRemaining: getFmtTimeRemaining((maxBytes - curBytes) / speedBytes),
          fmtThread: String(threads),
        };
      },
      sub: (cur: number, max: number, title: string) => ({
        fmtBar: generateProgBarBox(
          cur,
          max,
          appConfig.logger.progressBarConfig.barsize,
          detectUseFancyProgBarBox().shade,
        ),
        fmtPct: cur >= max ? '100.00' : mathUtils.rounder('ceil', ((cur ?? 0) / max) * 100, 2).padded.padStart(6, ' '),
        fmtValue: mathUtils.formatFileSize(cur, fmtFileSizeDefaultCfg).padStart(7, ' '),
        fmtTotal: mathUtils.formatFileSize(max, fmtFileSizeDefaultCfg).padStart(7, ' '),
        fmtTitle: title, // todo: length limit, etc.
      }),
    },
  },
  progBarFmtCfg: {
    hashing: {
      title: [
        chalk.bold(`Calculating hash`),
        'with',
        chalk.bold.green('{fmtThread}'),
        `threads${chalk.dim(',')}`,
        chalk.bold.cyan('{fmtValueFileCount}'),
        chalk.dim('/'),
        chalk.bold.cyan('{fmtTotalFileCount}'),
        chalk.dim(', ETA:'),
        chalk.bold.cyan('{fmtTimeRemaining}'),
      ].join(' '),
    },
    download: {
      title: [
        chalk.bold(`Downloading`),
        'with',
        chalk.bold.green('{fmtThread}'),
        `threads${chalk.dim(',')}`,
        chalk.bold.cyan('{fmtValueFileCount}'),
        chalk.dim('/'),
        chalk.bold.cyan('{fmtTotalFileCount}'),
        chalk.dim(', ETA:'),
        chalk.bold.cyan('{fmtTimeRemaining}'),
      ].join(' '),
      root: [
        chalk.cyanBright(detectUseFancyProgBarBox().fancy ? '{fmtBar}' : '{bar}'),
        chalk.bold.cyan('{fmtPct}%'),
        chalk.dim('│'),
        chalk.bold.cyan('{fmtValueBytes}'),
        chalk.dim('/'),
        chalk.bold.cyan('{fmtTotalBytes}'),
        chalk.dim('MiB │'),
        chalk.bold.cyan('{fmtSpeed}'),
        chalk.dim((appConfig.logger.useBitUnitForSpeed ? 'Mbps' : 'MB/s') + ' sum'),
      ].join(' '),
      sub: [
        chalk.green(detectUseFancyProgBarBox().fancy ? '{fmtBar}' : '{bar}'),
        chalk.cyan('{fmtPct}%'),
        chalk.dim(`│`),
        chalk.cyan('{fmtValue}'),
        chalk.dim(`/`),
        chalk.cyan('{fmtTotal}'),
        chalk.dim(`MiB │`),
        '{fmtTitle}',
      ].join(' '),
    },
  },
};
