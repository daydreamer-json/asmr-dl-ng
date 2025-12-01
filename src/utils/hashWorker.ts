/// <reference lib="webworker" />

const PROGRESS_INTERVAL_MS = 0;

self.addEventListener('error', (event) => {
  // Catch any unhandled errors in the worker
  self.postMessage({ type: 'error', error: { message: event.message, stack: event.error?.stack } });
});

self.onmessage = async (event: MessageEvent<{ filePath: string; algorithms: string[] }>) => {
  const { filePath, algorithms } = event.data;

  try {
    const file = Bun.file(filePath);
    const stream = file.stream();
    const hashers: { [key: string]: Bun.CryptoHasher } = {};
    algorithms.forEach((alg) => {
      hashers[alg] = new Bun.CryptoHasher(alg as any);
    });

    let lastProgressTime = 0;
    let chunkBuffer = 0;

    for await (const chunk of stream) {
      const now = Date.now();
      chunkBuffer += chunk.length;
      algorithms.forEach((alg) => hashers[alg]!.update(chunk));

      if (now - lastProgressTime > PROGRESS_INTERVAL_MS) {
        self.postMessage({ type: 'progress', chunk_size: chunkBuffer });
        chunkBuffer = 0;
        lastProgressTime = now;
      }
    }

    const calculatedHashes: { [key: string]: string } = {};
    algorithms.forEach((alg) => {
      calculatedHashes[alg] = hashers[alg]!.digest('hex');
    });

    if (chunkBuffer > 0) {
      self.postMessage({ type: 'progress', chunk_size: chunkBuffer });
    }

    self.postMessage({ type: 'done', result: calculatedHashes });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: { message: err.message, stack: err.stack } });
  }
};
