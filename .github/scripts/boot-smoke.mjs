import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const port = '3417';
const standaloneRoot = path.join(root, 'apps/web/.next/standalone/apps/web');
const web = spawn(process.execPath, [path.join(standaloneRoot, 'server.js')], {
  cwd: standaloneRoot,
  windowsHide: true,
  env: {
    ...process.env,
    PORT: port,
    HOSTNAME: '127.0.0.1',
    NERVA_ENVIRONMENT: 'LOCAL',
    NERVA_EXECUTION_ENABLED: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const worker = spawn(
  process.execPath,
  [path.join(root, 'node_modules/tsx/dist/cli.mjs'), 'apps/worker/src/main.ts'],
  {
    cwd: root,
    windowsHide: true,
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
  const stopped = await Promise.race([once(child, 'exit').then(() => true), delay(5000)]);
  if (stopped || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid !== undefined) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    await Promise.race([once(killer, 'exit'), delay(5000)]);
  } else {
    child.kill('SIGKILL');
  }
}

try {
  const deadline = Date.now() + 90_000;
  let live;
  let liveFailure = 'no HTTP response received';
  while (Date.now() < deadline) {
    if (web.exitCode !== null) throw new Error(`Web process exited: ${webOutput}`);
    if (worker.exitCode !== null) throw new Error(`Worker process exited: ${workerOutput}`);
    try {
      live = await fetch(`http://127.0.0.1:${port}/api/health/live`, {
        signal: AbortSignal.timeout(5000),
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
  const readyBody = await ready.json();
  if (process.env.DATABASE_URL) {
    if (
      !ready.ok ||
      readyBody.status !== 'ready' ||
      readyBody.dependencies?.database !== 'HEALTHY' ||
      readyBody.safety?.globalExecutionDisabled !== true
    )
      throw new Error(`Web readiness failed (${ready.status}): ${JSON.stringify(readyBody)}`);
  } else if (
    ready.status !== 503 ||
    readyBody.status !== 'not_ready' ||
    readyBody.dependencies?.database !== 'NOT_CONFIGURED' ||
    readyBody.safety?.globalExecutionDisabled !== true
  ) {
    throw new Error(
      `Web readiness did not fail closed (${ready.status}): ${JSON.stringify(readyBody)}`,
    );
  }
  for (const [label, path, expectedCopy, expectedDocumentLanguage] of [
    [
      'English default',
      '/',
      'Read-only market observations and policy simulation for perpetual markets on Monad.',
      'en',
    ],
    [
      'Brazilian Portuguese',
      '/?lang=pt-BR',
      'Observações de mercado somente para leitura e simulação de políticas para mercados perpétuos na Monad.',
      'pt-BR',
    ],
    [
      'Spanish',
      '/?lang=es',
      'Observaciones de mercado de solo lectura y simulación de políticas para mercados perpetuos en Monad.',
      'es',
    ],
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
  const workerDeadline = Date.now() + 30_000;
  while (
    !workerOutput.includes('worker started in observation mode') &&
    worker.exitCode === null &&
    Date.now() < workerDeadline
  ) {
    await delay(100);
  }
  if (!workerOutput.includes('worker started in observation mode'))
    throw new Error(
      `Worker safe-mode startup record missing (${workerLifecycle}): ${workerOutput}`,
    );
  if (!workerOutput.includes('"globalExecutionDisabled":true'))
    throw new Error(`Worker did not fail closed on the global execution control: ${workerOutput}`);
  console.log(
    JSON.stringify({
      ok: true,
      web: process.env.DATABASE_URL ? 'live+ready' : 'live+fail-closed-not-ready',
      worker: 'observation-mode',
      executionEnabled: false,
    }),
  );
} finally {
  await stop(worker);
  await stop(web);
}
