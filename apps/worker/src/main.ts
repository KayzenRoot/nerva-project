import { startWorker } from './worker.ts';

const worker = await startWorker();
const keepAlive = setInterval(() => undefined, 60_000);
const stop = async (signal: string) => {
  clearInterval(keepAlive);
  await worker.shutdown(signal);
  process.exitCode = 0;
};

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));
