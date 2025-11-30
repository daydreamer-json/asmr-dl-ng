import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import path from 'node:path';

function spawnAsync(
  command: string,
  args: string[],
  options: { cwd?: string; shell?: boolean },
  isStdPrint = false,
): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    // console.log(child.spawnargs);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => {
      isStdPrint ? process.stdout.write(data.toString()) : null;
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      isStdPrint ? process.stderr.write(data.toString()) : null;
      stderr += data.toString();
    });
    child.on('close', (exitCode) => {
      // const lines = isStdPrint
      //   ? stdout.replaceAll('\r\n', '\n').split('\n').length + stderr.replaceAll('\r\n', '\n').split('\n').length
      //   : 0;
      // for (let i = 0; i < lines; i++) {
      //   process.stdout.write('\x1B[1A');
      //   process.stdout.write('\x1B[2K');
      // }
      resolve({ stdout, stderr, exitCode });
    });
    child.on('exit', (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(`Spawned process error code ${exitCode}, '${path.basename(command)}'\n${stderr}`));
      }
    });
    child.on('error', (error) => {
      reject(error);
    });
  });
}

function spawnAsyncWithPipe(
  commandArray: {
    command: string;
    args: string[];
    options: { cwd?: string; shell?: boolean };
  }[],
) {
  return new Promise<void>((resolve, reject) => {
    const childArray: ChildProcessWithoutNullStreams[] = [];
    commandArray.forEach((element) => {
      childArray.push(spawn(element.command, element.args, element.options));
    });
    for (let i = 0; i < childArray.length - 1; i++) {
      childArray[i]!.stdout.pipe(childArray[i + 1]!.stdin);
    }
    childArray.slice(-1)[0]!.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve();
      } else {
        reject(new Error(`Spawned process error code ${exitCode}`));
      }
    });
  });
}

export default {
  spawnAsync,
  spawnAsyncWithPipe,
};
