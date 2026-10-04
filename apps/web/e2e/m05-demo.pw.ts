import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

const screenshots = '.engineering/evidence/NERVA-WO-006-artifacts';

test('M05-UI-001/MODE/DEMO-001/002: clean guided story, bounded timing and deterministic reset', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/demo?lang=en');
  await expect(page.getByText('DEMO ONLY · SYNTHETIC DATA').first()).toBeVisible();
  await expect(
    page.getByText('MAINNET effect: HARD_BLOCKED · Live Perpl writes: BLOCKED').first(),
  ).toBeVisible();
  await expect(page.getByText('LIVE READ ONLY.', { exact: false })).toBeVisible();
  const desktopDimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(desktopDimensions.document).toBeLessThanOrEqual(desktopDimensions.viewport);
  await page.getByRole('button', { name: 'Start guided demo' }).click();
  await page.clock.runFor(84_000);
  await expect(page.getByText('SIMULATED OUTCOME', { exact: true })).toBeVisible();
  await expect(page.getByText('84/84s')).toBeVisible();
  const story = await page.locator('.evidence-list').innerText();
  expect(story).toContain('OBSERVED · SYNTHETIC');
  expect(story).toContain('SIMULATED_OUTCOME');
  await expect(page.getByText(/no provider receipt or transaction exists/i)).toBeVisible();
  await expect
    .poll(async () =>
      page.locator('.progress-track span').evaluate((bar) => getComputedStyle(bar).width),
    )
    .toBe(await page.locator('.progress-track').evaluate((track) => getComputedStyle(track).width));
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: `${screenshots}/guided-demo-desktop.png` });
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('0/84s')).toBeVisible();
  await expect(page.getByText('SIMULATED OUTCOME', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start guided demo' }).click();
  await page.clock.runFor(84_000);
  await expect(page.getByText('84/84s')).toBeVisible();
  expect(await page.locator('.evidence-list').innerText()).toBe(story);
  expect(consoleErrors).toEqual([]);
});

test('M05-REFUSE-001..004: stale, revoked, changed delegate and degraded provider fail closed', async ({
  page,
}) => {
  await page.goto('/demo?lang=en');
  const cases = [
    ['Stale source', 'Source is stale. Current data cannot authorize a decision.'],
    ['Permission revoked', 'The parent permission is revoked. Derived authority is invalid.'],
    [
      'Delegate changed',
      'Delegation changed. Authority bound to the prior observation is invalid.',
    ],
    ['Provider degraded', 'Provider health is degraded. The path is non-actionable.'],
  ] as const;
  for (const [scenario, reason] of cases) {
    await page.getByRole('button', { name: new RegExp(scenario, 'i') }).click();
    await expect(page.getByRole('status').filter({ hasText: 'REFUSED' }).first()).toContainText(
      reason,
    );
    await expect(page.getByText('NO ACTION', { exact: false }).first()).toBeVisible();
  }
});

test('M05-UI-002/RESP-001/A11Y-001/I18N-001: mobile, keyboard and Spanish critical copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo?lang=pt-BR');
  await expect(page.getByText('SOMENTE DEMO · DADOS SINTÉTICOS').first()).toBeVisible();
  const mobileA11y = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    mobileA11y.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    ),
  ).toEqual([]);
  const dimensions = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: `${screenshots}/guided-demo-mobile.png` });
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveClass(/skip-link/);
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.getByRole('navigation').first()).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.progress-track span')
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).not.toBe('300ms');
  await page.goto('/demo?lang=es');
  await expect(page.getByText('SOLO DEMO · DATOS SINTÉTICOS').first()).toBeVisible();
  await expect(
    page.getByText('Efecto en mainnet: HARD_BLOCKED · Escrituras Perpl en vivo: BLOCKED').first(),
  ).toBeVisible();
});

test('M05-POLICY-001/002: bounded template validates without confirmation and free text stays local', async ({
  page,
}) => {
  await page.goto('/policies?lang=en');
  await page.getByRole('button', { name: 'Validate structured draft' }).click();
  await expect(page.getByText(/COMPILED_UNCONFIRMED/)).toBeVisible();
  await expect(page.getByText(/VALIDATION_ONLY/)).toBeVisible();
  const textarea = page.getByLabel('Untrusted plain-language proposal');
  await textarea.fill('Reduce the position if the margin moves.');
  await expect(page.getByText(/not sent · no LLM · proposal only/i)).toBeVisible();
  await expect(page.getByText(/does not create authority/i)).toBeVisible();
});

test('M05-A11Y-001: axe WCAG A/AA scan reports no critical or serious violations on key experience routes', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  for (const route of [
    '/?lang=en',
    '/demo?lang=en',
    '/dashboard?lang=en',
    '/policies?lang=en',
    '/permissions?lang=en',
    '/flight-recorder?lang=en',
  ]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const critical = results.violations.filter((violation) =>
      ['critical', 'serious'].includes(violation.impact ?? ''),
    );
    expect(
      critical,
      `${route}: ${JSON.stringify(critical.map(({ id, nodes }) => ({ id, count: nodes.length })))}`,
    ).toEqual([]);
  }
  expect(consoleErrors).toEqual([]);
});
