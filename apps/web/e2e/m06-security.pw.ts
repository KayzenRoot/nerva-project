import { expect, test } from '@playwright/test';

test('M06 security headers protect the shell and read-only health API', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const shell = await page.goto('/');
  expect(shell?.ok()).toBe(true);
  const shellHeaders = shell?.headers() ?? {};
  expect(shellHeaders['x-content-type-options']).toBe('nosniff');
  expect(shellHeaders['x-frame-options']).toBe('DENY');
  expect(shellHeaders['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(shellHeaders['strict-transport-security']).toBe('max-age=31536000');
  expect(shellHeaders['permissions-policy']).toContain('camera=()');

  const policy = shellHeaders['content-security-policy'] ?? '';
  const expectedEnvironment = process.env.NERVA_E2E_EXPECTED_ENV ?? 'LOCAL';
  const nonce = policy.match(/'nonce-([A-Za-z0-9+/]+=*)'/)?.[1];
  expect(nonce).toBeTruthy();
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  if (expectedEnvironment === 'LOCAL') {
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(policy).toContain("style-src-attr 'unsafe-inline'");
  } else {
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(policy).not.toContain("style-src-attr 'unsafe-inline'");
  }
  expect(
    await page
      .locator('script')
      .evaluateAll(
        (scripts, expectedNonce) =>
          scripts.some((script) => (script as HTMLScriptElement).nonce === expectedNonce),
        nonce,
      ),
  ).toBe(true);

  const health = await page.request.get('/api/health/live');
  expect(health.ok()).toBe(true);
  expect(health.headers()['x-content-type-options']).toBe('nosniff');
  expect(health.headers()['x-frame-options']).toBe('DENY');
  expect(await health.json()).toMatchObject({
    executionEnabled: false,
    environment: expectedEnvironment,
  });

  const refreshedShell = await page.reload();
  const refreshedPolicy = refreshedShell?.headers()['content-security-policy'] ?? '';
  const refreshedNonce = refreshedPolicy.match(/'nonce-([A-Za-z0-9+/]+=*)'/)?.[1];
  expect(refreshedNonce).toBeTruthy();
  expect(refreshedNonce).not.toBe(nonce);
  expect(consoleErrors).toEqual([]);
});
