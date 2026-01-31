/// <reference lib="webworker" />

const PROGRESS_INTERVAL_MS = 50;
const GC_THRESHOLD = 64 * 1024 * 1024; // 64MB
const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB

self.addEventListener('error', (event) => {
  // Catch any unhandled errors in the worker
  self.postMessage({ type: 'error', error: { message: event.message, stack: event.error?.stack } });
});

self.onmessage = async (event: MessageEvent<{ filePath: string; algorithms: string[] }>) => {
  const { filePath, algorithms } = event.data;

  let file: any = null;
  let hashers: { [key: string]: Bun.CryptoHasher } | null = {};

  try {
    file = Bun.file(filePath);
    const fileSize = file.size;

    algorithms.forEach((alg) => {
      hashers![alg] = new Bun.CryptoHasher(alg as any);
    });

    let lastProgressTime = 0;
    let chunkBuffer = 0;
    let bytesSinceLastGc = 0;

    for (let offset = 0; offset < fileSize; offset += CHUNK_SIZE) {
      const end = Math.min(offset + CHUNK_SIZE, fileSize);
      const chunkBlob = file.slice(offset, end);
      const chunk = await chunkBlob.arrayBuffer();
      const chunkView = new Uint8Array(chunk);

      algorithms.forEach((alg) => hashers![alg]!.update(chunkView));

      const currentChunkSize = chunkView.length;
      chunkBuffer += currentChunkSize;
      bytesSinceLastGc += currentChunkSize;

      const now = Date.now();
      if (now - lastProgressTime > PROGRESS_INTERVAL_MS) {
        self.postMessage({ type: 'progress', chunk_size: chunkBuffer });
        chunkBuffer = 0;
        lastProgressTime = now;
      }

      if (bytesSinceLastGc > GC_THRESHOLD) {
        Bun.gc(true);
        bytesSinceLastGc = 0;
      }
    }

    const calculatedHashes: { [key: string]: string } = {};
    algorithms.forEach((alg) => {
      calculatedHashes[alg] = hashers![alg]!.digest('hex');
    });

    if (chunkBuffer > 0) {
      self.postMessage({ type: 'progress', chunk_size: chunkBuffer });
    }

    self.postMessage({ type: 'done', result: calculatedHashes });
  } catch (err: any) {
    self.postMessage({ type: 'error', error: { message: err.message, stack: err.stack } });
  } finally {
    hashers = null;
    file = null;
    Bun.gc(true);
  }
};
