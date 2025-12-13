import path from 'node:path';
import chalk from 'chalk';
import CliTable3 from 'cli-table3';
// import { rimraf } from 'rimraf';
// import appConfig from '../utils/config.js';
import fileUtils from '../utils/file.js';
import logger from '../utils/logger.js';
import mathUtils from '../utils/math.js';
import subProcessAudioUtils from '../utils/subProcessAudio.js';
import termPrettyUtils from '../utils/termPretty.js';

async function mainCmdHandler() {
  // await rimraf('R:/audio_fluorite.flac');
  // await rimraf('R:/audio_fluorite.wv');
  // await rimraf('R:/audio_fluorite.m4a');
  // await rimraf('R:/audio_fluorite.opus');
  // logger.info(`Encoding FLAC (${appConfig.media.encoderArgv.flac.join(' ')}) ...`);
  // await subProcessAudioUtils.spawnFlacEnc(
  //   path.join(fileUtils.getAppRootDir(), 'bin', 'flac', 'flac.exe'),
  //   path.resolve('R:/audio_fluorite.wav'),
  //   path.resolve('R:/audio_fluorite.flac'),
  //   (progress) => {
  //     if (progress.type === 'progress') {
  //       logger.debug(
  //         'Encoding audio: ' +
  //           String(progress.percentage).padStart(3, ' ') +
  //           '%, Ratio: ' +
  //           mathUtils.rounder('ceil', progress.ratio!, 3).padded,
  //       );
  //     } else if (progress.type === 'done') {
  //       logger.info('Encode completed');
  //     }
  //   },
  // );
  // logger.info(`Encoding WavPack (${appConfig.media.encoderArgv.wavpack.join(' ')}) ...`);
  // await subProcessAudioUtils.spawnWavPackEnc(
  //   path.join(fileUtils.getAppRootDir(), 'bin', 'wavpack', 'wavpack.exe'),
  //   path.resolve('R:/audio_fluorite.wav'),
  //   path.resolve('R:/audio_fluorite.wv'),
  //   (progress) => {
  //     if (progress.type === 'progress') {
  //       logger.debug('Encoding audio: ' + String(progress.percentage).padStart(3, ' ') + '%');
  //     } else if (progress.type === 'done') {
  //       logger.info('Encode completed');
  //     }
  //   },
  // );
  // logger.info(`Encoding AAC (${appConfig.media.encoderArgv.qaac.join(' ')}) ...`);
  // await subProcessAudioUtils.spawnAacEnc(
  //   path.join(fileUtils.getAppRootDir(), 'bin', 'qaac', 'qaac64.exe'),
  //   path.resolve('R:/audio_fluorite.wav'),
  //   path.resolve('R:/audio_fluorite.m4a'),
  //   (progress) => {
  //     if (progress.type === 'progress') {
  //       logger.debug(
  //         'Encoding audio: ' +
  //           mathUtils.rounder('round', progress.percentage!, 1).padded.padStart(5, ' ') +
  //           '%, Speed: ' +
  //           progress.speed +
  //           'x',
  //       );
  //     } else if (progress.type === 'done') {
  //       logger.info('Encode completed');
  //     }
  //   },
  // );
  // logger.info(`Encoding Opus (${appConfig.media.encoderArgv.opus.join(' ')}) ...`);
  // await subProcessAudioUtils.spawnOpusEnc(
  //   path.join(fileUtils.getAppRootDir(), 'bin', 'opus', 'opusenc.exe'),
  //   path.resolve('R:/audio_fluorite.wav'),
  //   path.resolve('R:/audio_fluorite.opus'),
  //   (progress) => {
  //     if (progress.type === 'progress') {
  //       logger.debug(
  //         'Encoding audio: ' +
  //           mathUtils.rounder('round', progress.percentage!, 1).padded.padStart(5, ' ') +
  //           '%, Bitrate: ' +
  //           mathUtils.rounder('round', progress.kbps!, 1).padded.padStart(5, ' ') +
  //           'kbps, Speed: ' +
  //           progress.speed +
  //           'x',
  //       );
  //     } else if (progress.type === 'done') {
  //       logger.info('Encode completed');
  //     }
  //   },
  // );
  const mediaInfoResult = {
    wav: await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/audio_fluorite.wav'),
    ),
    flac: await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/audio_fluorite.flac'),
    ),
    wavpack: await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/audio_fluorite.wv'),
    ),
    aac: await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/audio_fluorite.m4a'),
    ),
    opus: await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/audio_fluorite.opus'),
    ),
  };
  logger.info('MediaInfo data fetched');
  (() => {
    const formatFileSizeOptions = {
      decimals: 2,
      decimalPadding: true,
      useBinaryUnit: true,
      useBitUnit: false,
      unitVisible: true,
      unit: 'M',
    } as const;
    const bitrateGetter = (keyName: keyof typeof mediaInfoResult) => {
      const tracks = mediaInfoResult[keyName].track;
      const rawBitrate: number = parseInt(tracks[1].BitRate ?? tracks[0].OverallBitRate);
      const bitrateMode: string | null = tracks[1].BitRate_Mode ?? tracks[0].OverallBitRate_Mode ?? null;
      const prettyBitrate: string =
        mathUtils
          .formatFileSize(rawBitrate, {
            ...formatFileSizeOptions,
            useBinaryUnit: false,
            unitVisible: false,
            unit: 'K',
          })
          .padStart(7, ' ') + ' kbps';
      return { rate: prettyBitrate, mode: bitrateMode };
    };
    const rowGetter = (keyName: keyof typeof mediaInfoResult) => {
      return [
        {
          hAlign: 'right' as const,
          content: chalk.cyan(
            mathUtils.formatFileSize(mediaInfoResult[keyName].track[0].FileSize, formatFileSizeOptions),
          ),
        },
        { hAlign: 'right' as const, content: chalk.cyan(bitrateGetter(keyName).rate) },
        bitrateGetter(keyName).mode ?? ' ? ',
        {
          hAlign: 'right' as const,
          content:
            mathUtils.rounder(
              'floor',
              (1 - mediaInfoResult[keyName].track[0].FileSize / mediaInfoResult.wav.track[0].FileSize) * 100,
              2,
            ).padded + ' %',
        },
        {
          hAlign: 'right' as const,
          content:
            mathUtils.rounder(
              'floor',
              mediaInfoResult.wav.track[0].FileSize / mediaInfoResult[keyName].track[0].FileSize,
              3,
            ).padded + ':1',
        },
      ];
    };
    const table = new CliTable3(termPrettyUtils.cliTableConfig.rounded);
    table.push(
      ...[
        ['Type', 'Format', 'Size', 'Bitrate', 'RC', 'Reduced', 'Ratio'].map((e) => chalk.dim(e)),
        ['Raw', 'WAV (PCM)', ...rowGetter('wav')],
        ['Lossless', 'FLAC', ...rowGetter('flac')],
        ['Lossless', 'WavPack', ...rowGetter('wavpack')],
        ['Lossy', 'AAC', ...rowGetter('aac')],
        ['Lossy', 'Opus', ...rowGetter('opus')],
      ],
    );
    console.log(table.toString());
  })();

  console.dir(
    await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/meta.yaml'),
    ),
    { depth: null },
  );
  console.dir(
    await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/YAML_FILE'),
    ),
    { depth: null },
  );
  console.dir(
    await subProcessAudioUtils.spawnMediaInfo(
      path.join(fileUtils.getAppRootDir(), 'bin', 'mediainfo', 'mediainfo.exe'),
      path.resolve('R:/JPEG_FILE'),
    ),
    { depth: null },
  );
}

export default mainCmdHandler;
