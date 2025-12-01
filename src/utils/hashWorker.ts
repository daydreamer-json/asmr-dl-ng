/// <reference lib="webworker" />

import crypto from 'node:crypto';
import fs from 'node:fs';

const PROGRESS_INTERVAL_MS = 0;

self.addEventListener('error', (event) => {
  // Catch any unhandled errors in the worker
  self.postMessage({ type: 'error', error: { message: event.message, stack: event.error?.stack } });
});

self.onmessage = async (event: MessageEvent<{ filePath: string; algorithms: string[] }>) => {
  const { filePath, algorithms } = event.data;

  try {
    const fileStream = fs.createReadStream(filePath);
    const hashes: { [key: string]: crypto.Hash } = {};
    algorithms.forEach((alg) => {
      hashes[alg] = crypto.createHash(alg);
    });

    let lastProgressTime = 0;
    let chunkBuffer = 0;

    fileStream.on('data', (chunk) => {
      const now = Date.now();
      chunkBuffer += chunk.length;
      algorithms.forEach((alg) => hashes[alg]!.update(chunk));

      if (now - lastProgressTime > PROGRESS_INTERVAL_MS) {
        self.postMessage({ type: 'progress', chunk_size: chunkBuffer });
        chunkBuffer = 0;
        lastProgressTime = now;
      }
    });

    fileStream.on('end', () => {
      const calculatedHashes: { [key: string]: string } = {};
      algorithms.forEach((alg) => {
        calculatedHashes[alg] = hashes[alg]!.digest('hex');
      });

      if (chunkBuffer > 0) {
        self.postMessage({ type: 'progress', chunk_size: chunkBuffer });
      }

      self.postMessage({ type: 'done', result: calculatedHashes });
    });

    fileStream.on('error', (err) => {
      self.postMessage({ type: 'error', error: { message: err.message, stack: err.stack } });
    });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: { message: err.message, stack: err.stack } });
  }
};
