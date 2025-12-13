import appConfig from './config.js';
import omitDeep from './omitDeep.js';

async function spawnFlacEnc(
  binPath: string,
  audioPathIn: string,
  audioPathOut: string,
  onProgress: (progress: {
    percentage?: number;
    ratio?: number;
    message: string;
    type: 'progress' | 'warning' | 'info' | 'done' | 'error';
  }) => void,
): Promise<void> {
  const args = [...appConfig.media.encoderArgv.flac, '-o', audioPathOut, audioPathIn];

  const proc = Bun.spawn([binPath, ...args], { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' });

  const decoder = new TextDecoder();
  const progressRegex = /(\d+)% complete, ratio=([\d.]+)/;

  (async () => {
    for await (const chunk of proc.stderr) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split('\r');
      const lastLine = lines.at(-1)!.trim().replaceAll('\b', '');

      if (!lastLine) continue;

      const progressMatch = lastLine.match(progressRegex);
      if (progressMatch && progressMatch[1] && progressMatch[2]) {
        onProgress({
          percentage: parseInt(progressMatch[1], 10),
          ratio: parseFloat(progressMatch[2]),
          message: lastLine,
          type: 'progress',
        });
      } else if (lastLine.includes('Verify OK') || lastLine.includes('wrote')) {
        onProgress({ message: lastLine, type: 'done' });
      } else if (lastLine.startsWith('WARNING:')) {
        onProgress({ message: lastLine, type: 'warning' });
      } else {
        onProgress({ message: lastLine, type: 'info' });
      }
    }
  })();

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const err = `flac process exited with code ${exitCode}`;
    onProgress({ message: err, type: 'error' });
    throw new Error(err);
  }
}

async function spawnWavPackEnc(
  binPath: string,
  audioPathIn: string,
  audioPathOut: string,
  onProgress: (progress: {
    percentage?: number;
    message: string;
    type: 'progress' | 'warning' | 'info' | 'done' | 'error';
  }) => void,
) {
  const args = [...appConfig.media.encoderArgv.wavpack, audioPathIn, audioPathOut];

  const proc = Bun.spawn([binPath, ...args], { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' });

  const decoder = new TextDecoder();
  const progressRegex = /(\d+)% done/;

  (async () => {
    for await (const chunk of proc.stderr) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split('\r');
      const lastLine = lines.at(-1)!.trim();

      if (!lastLine) continue;

      const progressMatch = lastLine.match(progressRegex);
      if (progressMatch && progressMatch[1]) {
        onProgress({
          percentage: parseInt(progressMatch[1], 10),
          message: lastLine,
          type: 'progress',
        });
      } else {
        onProgress({ message: lastLine, type: 'info' });
      }
    }
  })();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    const err = `wavpack process exited with code ${exitCode}\n${stderr}`;
    onProgress({ message: err, type: 'error' });
    throw new Error(err);
  }
  onProgress({ message: 'WavPack encoding finished', type: 'done' });
}

async function spawnAacEnc(
  binPath: string,
  audioPathIn: string,
  audioPathOut: string,
  onProgress: (progress: {
    percentage?: number;
    speed?: number;
    message: string;
    type: 'progress' | 'info' | 'error' | 'done';
  }) => void,
) {
  const args = [...appConfig.media.encoderArgv.qaac, '-o', audioPathOut, audioPathIn];

  const proc = Bun.spawn([binPath, ...args], { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' });

  const decoder = new TextDecoder();
  const progressRegex = /\[(\d+\.\d+)%\].+?\((.+?)x\)/;

  let stderrOutput: string = '';
  let lastPercentage: number = 0;
  let lastSpeed: number = 0;
  (async () => {
    for await (const chunk of proc.stderr) {
      const text = decoder.decode(chunk, { stream: true });
      stderrOutput += text;
      const lines = stderrOutput.split('\r');
      const lastLine = lines.at(-1)!.trim();
      if (!lastLine) continue;

      const progressMatch = lastLine.match(progressRegex);
      if (progressMatch && progressMatch[1] && progressMatch[2]) {
        const obj = {
          percentage: parseFloat(progressMatch[1]),
          speed: parseFloat(progressMatch[2]),
          message: lastLine,
          type: 'progress',
        } as const;
        if (!(lastPercentage === obj.percentage && lastSpeed === obj.speed)) {
          onProgress(obj);
        }
        lastPercentage = obj.percentage;
        lastSpeed = obj.speed;
      } else {
        onProgress({ message: lastLine, type: 'info' });
      }
    }
  })();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    const err = `qaac process exited with code ${exitCode}\n${stderr}`;
    onProgress({ message: err, type: 'error' });
    throw new Error(err);
  }
  onProgress({ message: 'qaac encoding finished', type: 'done' });
}

async function spawnOpusEnc(
  binPath: string,
  audioPathIn: string,
  audioPathOut: string,
  onProgress: (progress: {
    percentage?: number;
    speed?: number;
    kbps?: number;
    message: string;
    type: 'progress' | 'info' | 'error' | 'done';
  }) => void,
) {
  const args = [...appConfig.media.encoderArgv.opus, audioPathIn, audioPathOut];

  const proc = Bun.spawn([binPath, ...args], { stdin: 'ignore', stdout: 'ignore', stderr: 'pipe' });

  const decoder = new TextDecoder();
  const progressRegex = /\[.+?\].+?(\d+)% .+? (.+?)x realtime, (.+?) kbit\/s/;

  let stderrOutput = '';
  (async () => {
    for await (const chunk of proc.stderr) {
      const text = decoder.decode(chunk, { stream: true });
      stderrOutput += text;
      const lines = text.split('\r');
      const lastLine = lines.at(-1)!.trim();

      if (!lastLine) continue;

      const progressMatch = lastLine.match(progressRegex);
      if (progressMatch && progressMatch[1] && progressMatch[2] && progressMatch[3]) {
        onProgress({
          percentage: parseFloat(progressMatch[1]),
          speed: parseFloat(progressMatch[2]),
          kbps: parseFloat(progressMatch[3]),
          message: lastLine,
          type: 'progress',
        });
      } else {
        onProgress({ message: lastLine, type: 'info' });
      }
    }
  })();

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = `opus process exited with code ${exitCode}\n${stderrOutput}`;
    onProgress({ message: err, type: 'error' });
    throw new Error(err);
  }
  onProgress({ message: 'opus encoding finished', type: 'done' });
}

async function spawnMediaInfo(binPath: string, inputPath: string): Promise<any> {
  const args = ['--Output=JSON', inputPath];
  const proc = Bun.spawn([binPath, ...args], { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' });
  const decoder = new TextDecoder();
  let stdoutOutput = '';
  let stderrOutput = '';
  (async () => {
    for await (const chunk of proc.stdout) {
      const text = decoder.decode(chunk, { stream: true });
      stdoutOutput += text;
    }
    for await (const chunk of proc.stderr) {
      const text = decoder.decode(chunk, { stream: true });
      stderrOutput += text;
    }
  })();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const err = `mediainfo process exited with code ${exitCode}\n${stderrOutput}`;
    throw new Error(err);
  }

  return (() => {
    const tmp1 = omitDeep(JSON.parse(stdoutOutput), [
      ['creatingLibrary'],
      ['media', '@ref'],
      ['media', 'track', 0, 'File_Created_Date'],
      ['media', 'track', 0, 'File_Created_Date_Local'],
      ['media', 'track', 0, 'File_Modified_Date'],
      ['media', 'track', 0, 'File_Modified_Date_Local'],
      ['media', 'track', 0, 'extra', 'FileExtension_Invalid'],
    ]);
    const result = (() => {
      if (tmp1.media.track[0].extra && Object.keys(tmp1.media.track[0].extra).length === 0) {
        return omitDeep(tmp1, [['media', 'track', 0, 'extra']]);
      } else {
        return tmp1;
      }
    })();
    return result.media;
  })();
}

export default { spawnFlacEnc, spawnWavPackEnc, spawnAacEnc, spawnOpusEnc, spawnMediaInfo };
