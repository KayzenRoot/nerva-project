import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.NERVA_PLAYWRIGHT_PORT ?? '3100');
const externalBaseURL = process.env.NERVA_E2E_BASE_URL;
const isVercelPreview = (() => {
  if (!externalBaseURL) return false;
  try {
    return new URL(externalBaseURL).hostname.toLowerCase().endsWith('.vercel.app');
  } catch {
    return false;
  }
})();

export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: '**/*.pw.ts',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: externalBaseURL ?? `http://127.0.0.1:${port}`,
    ...(isVercelPreview ? { extraHTTPHeaders: { 'x-vercel-skip-toolbar': '1' } } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: `npm --workspace=@nerva/web run dev -- --hostname 127.0.0.1 --port ${port}`,
        url: `http://127.0.0.1:${port}/api/health/live`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NERVA_ENVIRONMENT: 'LOCAL',
          NERVA_EXECUTION_ENABLED: 'false',
          NERVA_KILL_SWITCH_ENABLED: 'true',
        },
      },
});
