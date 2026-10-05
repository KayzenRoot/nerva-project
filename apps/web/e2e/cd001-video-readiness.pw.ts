import AxeBuilder from '@axe-core/playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const recordingRoutes = [
  '/demo/recording/risk?lang=en',
  '/demo/recording/policy?lang=en',
  '/demo/recording/flight-recorder?lang=en',
] as const;
const evidenceDirectory = resolve(
  process.cwd(),
  '.engineering/evidence/NERVA-WO-007-CD-001-artifacts',
);

test('CD-001: official logo, synthetic recording path, and live isolation are explicit', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const browserErrors: string[] = [];
  const apiRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) {
      apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  for (const route of recordingRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByTestId('demo-only-label')).toContainText(
      'DEMO_ONLY · SYNTHETIC DATA · NOT PERSISTED',
    );
    const logo = page.locator('.recording-demo-brand img');
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        logo.evaluate((image) => {
          const logoImage = image as HTMLImageElement;
          return logoImage.complete && logoImage.naturalWidth > 0 && logoImage.naturalHeight > 0;
        }),
      )
      .toBe(true);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /\/branding\/nerva-logo\.png$/,
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute(
      'content',
      '1254',
    );
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute(
      'content',
      '1254',
    );
    expect(await page.locator('link[rel="icon"]').count()).toBeGreaterThan(0);
    await expect(page.locator('.recording-demo-footer')).toContainText(
      'MAINNET EFFECT = HARD_BLOCKED',
    );
    await expect(page.locator('.recording-demo-footer')).toContainText(
      'LIVE PERPL WRITES = BLOCKED',
    );
    await expect(page.locator('.recording-demo-footer')).toContainText(
      'NERVA_EXECUTION_ENABLED=false',
    );
  }

  await page.goto(recordingRoutes[0]);
  await expect(page.getByTestId('recording-risk')).toContainText('DEMO-SNAPSHOT-01');
  await expect(page.getByTestId('recording-risk')).toContainText('FRESH_SYNTHETIC');
  await expect(page.getByTestId('recording-risk')).toContainText('$12,400 synthetic');
  for (const metric of [
    'LIQUIDATION_DISTANCE',
    'MAINTENANCE_MARGIN',
    'FUNDING_DIRECTION',
    'UNAVAILABLE_UNPROVEN',
  ]) {
    await expect(page.getByTestId('recording-risk')).toContainText(metric);
  }
  await expect(page.getByTestId('recording-provenance')).toContainText('M05 Guided Demo');

  await page.goto(recordingRoutes[1]);
  const policy = page.getByTestId('recording-policy');
  for (const constraint of [
    'Synthetic adverse-move threshold crossed',
    'REDUCE_POSITION',
    '10% of the synthetic position',
    '$1,240 synthetic',
    '75 bps',
    'Perpl ETH-PERP',
    '15 minutes',
    '20 minutes',
    'NO_ACTION on STALE, UNKNOWN',
    'no wallet signature',
  ]) {
    await expect(policy).toContainText(constraint);
  }
  const jsonDetails = page.getByTestId('recording-json');
  await jsonDetails.locator('summary').click();
  await expect(jsonDetails).toContainText('"kind": "LOCAL_DEMO_DISPLAY_FIXTURE"');
  await expect(jsonDetails).toContainText('"executionEnabled": false');

  await page.goto(recordingRoutes[2]);
  await expect(page.getByTestId('recording-lineage-stage')).toHaveCount(7);
  for (const stage of [
    'Source',
    'Risk evidence',
    'Policy',
    'Trigger',
    'Plan / simulation',
    'Permission',
    'Decision / outcome',
  ]) {
    await expect(page.getByTestId('recording-flight-recorder')).toContainText(stage);
  }
  await expect(page.getByTestId('recording-flight-recorder')).toContainText('DRY_RUN_ONLY');
  await expect(page.getByTestId('recording-flight-recorder')).toContainText('NOT PERSISTED');

  const iconResponse = await page.goto(new URL('/icon.png', page.url()).toString());
  expect(iconResponse?.status()).toBe(200);
  expect(iconResponse?.headers()['content-type']).toContain('image/png');

  expect(apiRequests).toEqual([]);

  for (const route of ['/dashboard?lang=en', '/policies?lang=en', '/flight-recorder?lang=en']) {
    await page.goto(route);
    await expect(page.locator('.live-mode-banner')).toContainText('LIVE READ ONLY');
    await expect(page.getByTestId('demo-only-label')).toHaveCount(0);
    await expect(page.getByText('DEMO-SNAPSHOT-01', { exact: true })).toHaveCount(0);
  }
  expect(browserErrors).toEqual([]);
});

test('CD-001: recording surfaces fit desktop/mobile, honor reduced motion, and pass axe', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    for (const route of recordingRoutes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      const dimensions = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }));
      expect(dimensions.document, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(
        dimensions.viewport,
      );
      expect(dimensions.reducedMotion).toBe(true);

      const motionDurations = await page.locator('.recording-surface').evaluate((element) => {
        element.setAttribute('style', 'animation-duration: 5s; transition-duration: 5s');
        const style = getComputedStyle(element);
        return [style.animationDuration, style.transitionDuration];
      });
      for (const duration of motionDurations) {
        const milliseconds = duration.endsWith('ms')
          ? Number.parseFloat(duration)
          : Number.parseFloat(duration) * 1000;
        expect(milliseconds).toBeLessThanOrEqual(0.01);
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.filter((violation) =>
          ['critical', 'serious'].includes(violation.impact ?? ''),
        ),
        `${route} at ${viewport.width}px`,
      ).toEqual([]);
    }
  }
});

test('CD-001: recording surfaces retain English, Brazilian Portuguese, and Spanish copy', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const localizedHeadings = {
    en: [
      'Risk, with its source in view.',
      'Bounded policy, readable before its JSON.',
      'A synthetic trace you can follow.',
    ],
    'pt-BR': [
      'Risco com a origem visível.',
      'Política limitada, legível antes do JSON.',
      'Uma trilha sintética que você pode acompanhar.',
    ],
    es: [
      'Riesgo con su fuente a la vista.',
      'Política limitada, legible antes del JSON.',
      'Una traza sintética que puedes seguir.',
    ],
  } as const;

  for (const locale of ['en', 'pt-BR', 'es'] as const) {
    for (const [index, route] of recordingRoutes.entries()) {
      const localizedRoute = route.replace('lang=en', `lang=${locale}`);
      const response = await page.goto(localizedRoute);
      expect(response?.status(), localizedRoute).toBe(200);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('h1')).toHaveText(localizedHeadings[locale][index]!);
      await expect(page.getByTestId('demo-only-label')).toContainText(
        'DEMO_ONLY · SYNTHETIC DATA · NOT PERSISTED',
      );
    }
  }
});

test('CD-001: regenerate video evidence screenshots at the required viewport sizes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await mkdir(evidenceDirectory, { recursive: true });
  const captures = [
    { file: 'home-desktop.png', route: '/?lang=en', viewport: { width: 1440, height: 900 } },
    { file: 'home-mobile.png', route: '/?lang=en', viewport: { width: 390, height: 844 } },
    {
      file: 'risk-demo-desktop.png',
      route: recordingRoutes[0],
      viewport: { width: 1440, height: 900 },
    },
    {
      file: 'policy-demo-desktop.png',
      route: recordingRoutes[1],
      viewport: { width: 1440, height: 900 },
    },
    {
      file: 'guided-demo-desktop.png',
      route: '/demo?lang=en',
      viewport: { width: 1440, height: 900 },
    },
    {
      file: 'guided-demo-mobile.png',
      route: '/demo?lang=en',
      viewport: { width: 390, height: 844 },
    },
    {
      file: 'flight-recorder-demo-desktop.png',
      route: recordingRoutes[2],
      viewport: { width: 1440, height: 900 },
    },
  ] as const;

  for (const capture of captures) {
    await page.setViewportSize(capture.viewport);
    const response = await page.goto(capture.route);
    expect(response?.status(), capture.route).toBe(200);
    await page.locator('main').waitFor({ state: 'visible' });
    await page.waitForFunction(() =>
      Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    );
    await page.evaluate(() => document.fonts.ready);
    const destination = resolve(evidenceDirectory, capture.file);
    const screenshot = await page.screenshot({ animations: 'disabled' });
    const existing = await readFile(destination).catch(() => undefined);
    if (!existing?.equals(screenshot)) {
      await writeFile(destination, screenshot);
    }
  }
});
