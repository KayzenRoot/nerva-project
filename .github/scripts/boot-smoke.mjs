import { spawn } from 'node:child_process';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const port = '3417';
const web = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/next/dist/bin/next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    port,
  ],
  {
    cwd: path.join(root, 'apps/web'),
    env: {
      ...process.env,
      PORT: port,
      NERVA_ENVIRONMENT: 'LOCAL',
      NERVA_EXECUTION_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
const worker = spawn(
  process.execPath,
  [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'apps/worker/src/main.ts'],
  {
    cwd: root,
    env: {
      ...process.env,
      NERVA_ENVIRONMENT: 'LOCAL',
      NERVA_EXECUTION_ENABLED: 'false',
      NERVA_LOG_LEVEL: 'info',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let webOutput = '';
let workerOutput = '';
let workerLifecycle = 'spawn pending';
worker.on('spawn', () => {
  workerLifecycle = `spawned pid=${worker.pid}`;
});
worker.on('error', (error) => {
  workerLifecycle = `spawn error=${error.message}`;
});
worker.on('exit', (code, signal) => {
  workerLifecycle = `exited code=${code} signal=${signal}`;
});
web.stdout.on('data', (chunk) => {
  webOutput += String(chunk);
});
web.stderr.on('data', (chunk) => {
  webOutput += String(chunk);
});
worker.stdout.on('data', (chunk) => {
  workerOutput += String(chunk);
});
worker.stderr.on('data', (chunk) => {
  workerOutput += String(chunk);
});

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

try {
  const deadline = Date.now() + 30_000;
  let live;
  let liveFailure = 'no HTTP response received';
  while (Date.now() < deadline) {
    if (web.exitCode !== null) throw new Error(`Web process exited: ${webOutput}`);
    if (worker.exitCode !== null) throw new Error(`Worker process exited: ${workerOutput}`);
    try {
      live = await fetch(`http://127.0.0.1:${port}/api/health/live`, {
        signal: AbortSignal.timeout(1000),
      });
      if (live.ok) break;
      liveFailure = `HTTP ${live.status}: ${await live.clone().text()}`;
    } catch (error) {
      // The web server may still be starting; retry on the next probe.
      liveFailure = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  if (!live?.ok)
    throw new Error(`Web live health did not become ready (${liveFailure}): ${webOutput}`);
  const liveBody = await live.json();
  if (liveBody.executionEnabled !== false || liveBody.status !== 'live')
    throw new Error('Web live health reported an unsafe state');
  const ready = await fetch(`http://127.0.0.1:${port}/api/health/ready`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!ready.ok)
    throw new Error(
      `Web readiness failed (${ready.status}): ${JSON.stringify(await ready.json())}`,
    );
  for (const [label, path, expectedCopy, expectedDocumentLanguage] of [
    ['English default', '/', 'Protection starts with clear limits.', 'en'],
    ['Brazilian Portuguese', '/?lang=pt-BR', 'Proteção começa com limites claros.', 'pt-BR'],
    ['Spanish', '/?lang=es', 'La protección comienza con límites claros.', 'es'],
  ]) {
    const page = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(5000),
    });
    const html = await page.text();
    if (
      !page.ok ||
      !html.includes(expectedCopy) ||
      !html.includes(`<html lang="${expectedDocumentLanguage}"`)
    )
      throw new Error(`${label} page did not render the expected locale (${page.status})`);
  }
  const workerDeadline = Date.now() + 10_000;
  while (
    !workerOutput.includes('worker started without external integrations') &&
    worker.exitCode === null &&
    Date.now() < workerDeadline
  ) {
    await delay(100);
  }
  if (!workerOutput.includes('worker started without external integrations'))
    throw new Error(
      `Worker safe-mode startup record missing (${workerLifecycle}): ${workerOutput}`,
    );
  if (!workerOutput.includes('"globalExecutionDisabled":true'))
    throw new Error(`Worker did not fail closed on the global execution control: ${workerOutput}`);
  console.log(
    JSON.stringify({ ok: true, web: 'live+ready', worker: 'safe-mode', executionEnabled: false }),
  );
} finally {
  await stop(worker);
  await stop(web);
}
