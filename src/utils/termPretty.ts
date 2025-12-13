import { eld } from '@yutengjing/eld';
import * as budoux from 'budoux';
import chalk from 'chalk';
import CliTable3 from 'cli-table3';
import { DateTime, Duration } from 'luxon';
import stringWidth from 'string-width';
import * as wakachigaki from 'wakachigaki';
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

function wordWrapper(str: string, width: number): string[] {
  // 1. Google's budoux (high quality)
  // 2. wakachigaki (medium quality),
  // 3. force wrap
  const langDetectResultObj: {
    language: string;
    getScores: () => Record<string, number>;
    isReliable: () => boolean;
  } = eld.detect(str);
  const langDetectResult: string = langDetectResultObj.language === '' ? 'ja' : langDetectResultObj.language;
  const budouxParser = {
    ja: budoux.loadDefaultJapaneseParser(),
    zh: budoux.loadDefaultSimplifiedChineseParser(),
  };
  const parseResult: string[] | null = (() => {
    const isBudouxAvail = Object.keys(budouxParser).includes(langDetectResult);
    if (isBudouxAvail) {
      const budouxResult = budouxParser[langDetectResult as keyof typeof budouxParser].parse(str);
      return budouxResult.length <= 1 && langDetectResult === 'ja' ? wakachigaki.tokenize(str) : budouxResult;
    }
    return null; // fallback to force wrap
  })();
  const lines: string[] = [];
  let currentLine = '';
  for (const segment of parseResult ?? str) {
    if (stringWidth(segment) > width) {
      if (currentLine) {
        lines.push(currentLine);
      }
      let tempSegment = segment;
      while (stringWidth(tempSegment) > width) {
        let splitIndex = 0;
        let currentWidth = 0;
        for (const char of tempSegment) {
          const charWidth = stringWidth(char);
          if (currentWidth + charWidth > width) break;
          currentWidth += charWidth;
          splitIndex++;
        }
        lines.push(tempSegment.slice(0, splitIndex));
        tempSegment = tempSegment.slice(splitIndex);
      }
      currentLine = tempSegment;
    } else if (stringWidth(currentLine + segment) > width) {
      lines.push(currentLine);
      currentLine = segment;
    } else {
      currentLine += segment;
    }
  }
  lines.push(currentLine);
  return lines;
}

function wordWrapperSimple(strArray: string[], width: number): string[] {
  const lines: string[] = [];
  let currentLine = '';
  for (const segment of strArray) {
    if (stringWidth(segment) > width) {
      if (currentLine) {
        lines.push(currentLine);
      }
      let tempSegment = segment;
      while (stringWidth(tempSegment) > width) {
        let splitIndex = 0;
        let currentWidth = 0;
        for (const char of tempSegment) {
          const charWidth = stringWidth(char);
          if (currentWidth + charWidth > width) break;
          currentWidth += charWidth;
          splitIndex++;
        }
        lines.push(tempSegment.slice(0, splitIndex));
        tempSegment = tempSegment.slice(splitIndex);
      }
      currentLine = tempSegment;
    } else if (stringWidth(currentLine + segment) > width) {
      lines.push(currentLine);
      currentLine = segment;
    } else {
      currentLine += segment;
    }
  }
  lines.push(currentLine);
  return lines;
}

function printWorkInfo(workApiRsp: {
  info: TypesApiEndpoint.RspWorkInfoSanitized;
  fileEntry: {
    raw: TypesApiFiles.FilesystemEntry[];
    transformed: TypesApiFiles.FilesystemEntryTransformed[];
  };
}): string {
  const table = new CliTable3(cliTableConfig.rounded);
  const availableMaxTextWidth = Math.min(54, process.stdout.columns - 20);

  const tmpObj = {
    dlCount: workApiRsp.info.dl_count.toLocaleString(),
    price: workApiRsp.info.price.toLocaleString(),
    totalSales: (workApiRsp.info.price * workApiRsp.info.dl_count).toLocaleString(),
    totalSize: mathUtils.formatFileSize(
      mathUtils.arrayTotal(workApiRsp.fileEntry.transformed.map((e) => e.size)),
      fmtFileSizeDefaultCfg,
    ),
  };

  table.push(
    ...[
      ['ID', workApiRsp.info.source_id],
      ['Title', wordWrapper(workApiRsp.info.title, availableMaxTextWidth).join('\n')],
      // ['Circle ID', workApiRsp.info.circle.source_id],
      ['Circle Name', wordWrapper(workApiRsp.info.circle.name, availableMaxTextWidth).join('\n')],
      [
        'VA Name',
        wordWrapperSimple(
          workApiRsp.info.vas
            .map((e) => e.name.replace(/^N\/A$/g, chalk.dim('(none)')))
            .map((s, i, arr) => (i === arr.length - 1 ? s : s + ', ')),
          availableMaxTextWidth,
        ).join('\n'),
      ],
      [
        'Tags',
        wordWrapperSimple(
          workApiRsp.info.tags
            .map((e) => {
              if (e.i18n && e.i18n['ja-jp'] && e.i18n['ja-jp'].name) return e.i18n['ja-jp'].name;
              return e.name;
            })
            .map((s, i, arr) => (i === arr.length - 1 ? s : s + ', ')),
          availableMaxTextWidth,
        ).join('\n'),
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
      ['DL Count', tmpObj.dlCount.padStart(mathUtils.arrayMax(Object.values(tmpObj).map((e) => e.length)), ' ')],
      ['Price', tmpObj.price.padStart(mathUtils.arrayMax(Object.values(tmpObj).map((e) => e.length)), ' ') + ' JPY'],
      [
        'Total Sales',
        tmpObj.totalSales.padStart(mathUtils.arrayMax(Object.values(tmpObj).map((e) => e.length)), ' ') + ' JPY',
      ],
      [
        'Total Size',
        tmpObj.totalSize.padStart(mathUtils.arrayMax(Object.values(tmpObj).map((e) => e.length)), ' ') +
          ' MiB (' +
          workApiRsp.fileEntry.transformed.length +
          ' files)',
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
  seconds = !Number.isFinite(seconds) || Number.isNaN(seconds) ? 0 : Math.ceil(seconds);
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
          fmtSpeed: mathUtils
            .formatFileSize(speedBytes, {
              ...fmtFileSizeDefaultCfg,
              useBitUnit: appConfig.logger.useBitUnitForSpeed,
            })
            .padStart(6, ' '),
          // fmtSpeedRaw: speedBytes,
          fmtTimeRemaining: getFmtTimeRemaining((maxBytes - curBytes) / speedBytes),
          fmtThread: String(threads),
        };
      },
      sub: (cur: number, max: number, speed: number, title: string) => ({
        fmtBar: generateProgBarBox(
          cur,
          max,
          appConfig.logger.progressBarConfig.barsize,
          detectUseFancyProgBarBox().shade,
        ),
        fmtPct: cur >= max ? '100.00' : mathUtils.rounder('ceil', ((cur ?? 0) / max) * 100, 2).padded.padStart(6, ' '),
        fmtValue: mathUtils.formatFileSize(cur, fmtFileSizeDefaultCfg).padStart(7, ' '),
        fmtTotal: mathUtils.formatFileSize(max, fmtFileSizeDefaultCfg).padStart(7, ' '),
        fmtSpeed: mathUtils
          .formatFileSize(speed, {
            ...fmtFileSizeDefaultCfg,
            useBitUnit: appConfig.logger.useBitUnitForSpeed,
          })
          .padStart(6, ' '),
        fmtTitle: title, // todo: length limit, etc.
      }),
    },
  },
  progBarFmtCfg: {
    encoding: {
      mediaInfo: {
        title: [
          chalk.bold(`Fetching MediaInfo`),
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
        ].join(' '),
      },
    },
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
        // '{fmtTitle}',
        chalk.cyan('{fmtSpeed}'),
        chalk.dim(appConfig.logger.useBitUnitForSpeed ? 'Mbps' : 'MiB/s'),
      ].join(' '),
    },
  },
};
