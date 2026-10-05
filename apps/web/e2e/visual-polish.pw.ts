import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const coreRoutes = [
  '/?lang=en',
  '/demo?lang=en',
  '/dashboard?lang=en',
  '/policies?lang=en',
  '/permissions?lang=en',
  '/flight-recorder?lang=en',
  '/demo/recording/risk?lang=en',
  '/demo/recording/policy?lang=en',
  '/demo/recording/flight-recorder?lang=en',
  '/metropolis/technical-demo',
  '/metropolis/pitch-video',
] as const;

test('VIS-001: core product and submission routes load without browser errors', async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  for (const route of coreRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator('main')).toBeVisible();
  }

  expect(browserErrors).toEqual([]);
});

test('VIS-002: video routes are honest placeholders and retain every public safety boundary', async ({
  page,
}) => {
  await page.goto('/metropolis/technical-demo');
  await expect(page).toHaveTitle('NERVA Technical Demo — Video in production');
  await expect(
    page.getByRole('heading', { name: 'NERVA Technical Demo — Video in production' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'Technical walkthrough will demonstrate Risk Dashboard, Policy Builder, Guided Demo, permission boundaries and Flight Recorder.',
    ),
  ).toBeVisible();
  await expect(page.getByText('Temporary submission placeholder')).toBeVisible();
  await expect(
    page.getByText(
      'The official video is currently being produced and will replace this temporary page before final submission.',
    ),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Open NERVA Live Demo/ })).toHaveAttribute(
    'href',
    '/demo?lang=en',
  );
  await expect(page.getByText('TESTNET_DEMO', { exact: true })).toBeVisible();
  await expect(page.getByText('MAINNET EFFECT = HARD_BLOCKED')).toBeVisible();
  await expect(page.getByText('LIVE PERPL WRITES = BLOCKED')).toBeVisible();
  await expect(page.locator('video, iframe')).toHaveCount(0);

  await page.goto('/metropolis/pitch-video');
  await expect(page).toHaveTitle('NERVA Pitch Video — Video in production');
  await expect(
    page.getByRole('heading', { name: 'NERVA Pitch Video — Video in production' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Pitch video will introduce the problem, NERVA's safety-first approach, market opportunity and roadmap.",
    ),
  ).toBeVisible();
  await expect(page.getByText('MAINNET EFFECT = HARD_BLOCKED')).toBeVisible();
  await expect(page.getByText('LIVE PERPL WRITES = BLOCKED')).toBeVisible();
  await expect(page.locator('video, iframe')).toHaveCount(0);
});

test('VIS-003: desktop and mobile layouts fit and new placeholders pass serious WCAG scans', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of [
      '/?lang=en',
      '/demo?lang=en',
      '/flight-recorder?lang=en',
      '/metropolis/technical-demo',
      '/metropolis/pitch-video',
    ]) {
      await page.goto(route);
      const dimensions = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(dimensions.document, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(
        dimensions.viewport,
      );
    }
  }

  for (const route of ['/metropolis/technical-demo', '/metropolis/pitch-video']) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.filter((violation) =>
        ['critical', 'serious'].includes(violation.impact ?? ''),
      ),
      route,
    ).toEqual([]);
  }
});

test('VIS-004: guided demo and Flight Recorder expose the narrated evidence sequence', async ({
  page,
}) => {
  await page.goto('/demo?lang=en');
  await expect(page.getByRole('list', { name: 'Guided demo' })).toBeVisible();
  await expect(page.locator('.guided-steps li')).toHaveCount(7);
  const stepper = await page.locator('.guided-steps').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(stepper.scrollWidth).toBeLessThanOrEqual(stepper.clientWidth);
  for (const label of [
    'Context',
    'Risk',
    'Policy',
    'Shock',
    'Protection',
    'Outcome',
    'Flight Recorder',
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  await page.goto('/flight-recorder?lang=en');
  await expect(page.getByRole('heading', { name: 'Decision evidence lineage' })).toBeVisible();
  await expect(page.getByTestId('flight-lineage-stage')).toHaveCount(7);
  await expect(page.getByText(/Empty or unknown records remain explicit/)).toBeVisible();
});
