import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const screenshots =
  process.env.NERVA_EVIDENCE_SCREENSHOT_DIR ?? '.engineering/evidence/NERVA-WO-006-artifacts';

async function assertRefusedScenario(page: Page, scenario: string, reason: string) {
  await page.getByRole('button', { name: new RegExp(scenario, 'i') }).click();
  await expect(page.getByRole('status').filter({ hasText: 'REFUSED' }).first()).toContainText(
    reason,
  );
  await expect(page.getByText('NO ACTION', { exact: false }).first()).toBeVisible();
}

async function assertAccessibleRoute(page: Page, route: string) {
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

async function assertNavigationFits(page: Page, label: string, expectedLinks: number) {
  const navigation = page.getByRole('navigation', { name: label });
  await expect(navigation).toBeVisible();
  const geometry = await navigation.evaluate((element) => {
    const navRect = element.getBoundingClientRect();
    return {
      nav: {
        left: navRect.left,
        right: navRect.right,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      },
      links: Array.from(element.querySelectorAll('a')).map((link) => {
        const rect = link.getBoundingClientRect();
        return {
          name: link.textContent?.trim() ?? '',
          href: link.getAttribute('href'),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          clientWidth: link.clientWidth,
          scrollWidth: link.scrollWidth,
        };
      }),
    };
  });

  expect(geometry.links).toHaveLength(expectedLinks);
  expect(geometry.nav.scrollWidth).toBeLessThanOrEqual(geometry.nav.clientWidth + 1);
  for (const link of geometry.links) {
    expect(link.name).not.toBe('');
    expect(link.href).not.toBeNull();
    expect(link.width).toBeGreaterThan(0);
    expect(link.height).toBeGreaterThan(0);
    expect(link.left).toBeGreaterThanOrEqual(geometry.nav.left - 1);
    expect(link.right).toBeLessThanOrEqual(geometry.nav.right + 1);
    expect(link.scrollWidth).toBeLessThanOrEqual(link.clientWidth + 1);
  }
  return geometry.links.map(({ name, href }) => ({ name, href: href! }));
}

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
  await expect(page.locator('.phase-summary')).toContainText('Context · 0–10s');
  await expect(page.locator('.phase-summary')).toContainText('DEMO-ACCOUNT-01');
  await expect(page.locator('.phase-summary')).toContainText('DEMO-ETH-PERP-01');
  await page.getByRole('button', { name: 'Start guided demo' }).click();
  await page.clock.runFor(10_000);
  await expect(page.getByText('10/90s')).toBeVisible();
  await expect(page.locator('.phase-summary')).toContainText('Risk · 10–25s');
  await page.clock.runFor(15_000);
  await expect(page.getByText('25/90s')).toBeVisible();
  await expect(page.locator('.phase-summary')).toContainText('Policy · 25–40s');
  const policyConstraints = page.getByTestId('demo-policy-constraints');
  await expect(policyConstraints).toContainText('Synthetic adverse-move threshold');
  await expect(policyConstraints).toContainText('REDUCE_POSITION');
  await expect(policyConstraints).toContainText('10%');
  await expect(policyConstraints).toContainText('$1,240 synthetic');
  await expect(policyConstraints).toContainText('75 bps');
  await expect(policyConstraints).toContainText('Perpl ETH-PERP');
  await expect(policyConstraints).toContainText('15 minutes');
  await expect(policyConstraints).toContainText('20 minutes');
  await expect(policyConstraints).toContainText('NO_ACTION');
  await expect(policyConstraints).toContainText('no wallet signature');
  await page.clock.runFor(15_000);
  await expect(page.getByText('40/90s')).toBeVisible();
  await expect(page.locator('.phase-summary')).toContainText('Deterioration · 40–55s');
  await page.clock.runFor(15_000);
  await expect(page.getByText('55/90s')).toBeVisible();
  await expect(page.locator('.phase-summary')).toContainText('Safety · 55–70s');
  await page.clock.runFor(15_000);
  await expect(page.getByText('70/90s')).toBeVisible();
  await expect(page.getByText('SIMULATED OUTCOME', { exact: true })).toBeVisible();
  await expect(page.locator('.phase-summary')).toContainText('Outcome · 70–82s');
  await expect(page.getByText('DRY_RUN_ONLY', { exact: false }).first()).toBeVisible();
  await page.clock.runFor(12_000);
  await expect(page.getByText('82/90s')).toBeVisible();
  await expect(page.locator('.phase-summary')).toContainText('Closeout · 82–90s');
  await expect(page.getByTestId('guided-closeout')).toContainText('Flight Recorder lineage');
  await expect(page.getByTestId('guided-closeout')).toContainText('institutional teams');
  await page.clock.runFor(8_000);
  await expect(page.getByText('90/90s')).toBeVisible();
  const story = await page.locator('.evidence-list').innerText();
  expect(story).toContain('OBSERVED · SYNTHETIC');
  expect(story).toContain('SIMULATED_OUTCOME');
  await expect(page.getByText(/no provider receipt or transaction exists/i)).toBeVisible();
  await expect
    .poll(() =>
      page.locator('.progress-track').evaluate((track) => (track as HTMLProgressElement).value),
    )
    .toBe(90);
  await mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: `${screenshots}/guided-demo-desktop.png` });
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.getByText('0/90s')).toBeVisible();
  await expect(page.getByText('SIMULATED OUTCOME', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start guided demo' }).click();
  await page.clock.runFor(90_000);
  await expect(page.getByText('90/90s')).toBeVisible();
  expect(await page.locator('.evidence-list').innerText()).toBe(story);
  expect(consoleErrors).toEqual([]);
});

test('M05-REFUSE-001..004: stale, revoked, changed delegate and degraded provider fail closed', async ({
  page,
}) => {
  await page.goto('/demo?lang=en');
  await assertRefusedScenario(
    page,
    'Stale source',
    'Source is stale. Current data cannot authorize a decision.',
  );
  await assertRefusedScenario(
    page,
    'Permission revoked',
    'The parent permission is revoked. Derived authority is invalid.',
  );
  await assertRefusedScenario(
    page,
    'Delegate changed',
    'Delegation changed. Authority bound to the prior observation is invalid.',
  );
  await assertRefusedScenario(
    page,
    'Provider degraded',
    'Provider health is degraded. The path is non-actionable.',
  );
});

test('M05-UI-002/RESP-001/A11Y-001/I18N-001: mobile, keyboard and Spanish critical copy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo?lang=pt-BR');
  await expect(page.getByText('SOMENTE DEMO · DADOS SINTÉTICOS').first()).toBeVisible();
  const primaryDestinations = await assertNavigationFits(page, 'Navegação principal', 6);
  for (const destination of primaryDestinations) {
    const expectedUrl = new URL(destination.href, page.url()).href;
    await page.getByRole('link', { name: destination.name, exact: true }).click();
    await expect(page).toHaveURL(expectedUrl);
    await page.goto('/demo?lang=pt-BR');
  }
  await page.goto('/flight-recorder?lang=pt-BR');
  await assertNavigationFits(page, 'Navegação principal', 5);
  await page.goto('/demo?lang=pt-BR');
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
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );
  await page.goto('/demo?lang=es');
  await expect(page.getByText('SOLO DEMO · DATOS SINTÉTICOS').first()).toBeVisible();
  await expect(
    page.getByText('Efecto en mainnet: HARD_BLOCKED · Escrituras Perpl en vivo: BLOCKED').first(),
  ).toBeVisible();
  await page.goto('/?lang=pt-BR');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('link', { name: /iniciar demo guiada/i })).toBeVisible();
  await expect(page.getByText('Risco determinístico')).toBeVisible();
  await expect(page.getByText('ATUALIDADE').first()).toBeVisible();
  await page.goto('/?lang=es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('link', { name: /iniciar demo guiada/i })).toBeVisible();
  await expect(page.getByText('Riesgo determinista')).toBeVisible();
  await expect(page.getByText('VIGENCIA').first()).toBeVisible();
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
  await assertAccessibleRoute(page, '/?lang=en');
  await assertAccessibleRoute(page, '/demo?lang=en');
  await assertAccessibleRoute(page, '/dashboard?lang=en');
  await assertAccessibleRoute(page, '/policies?lang=en');
  await assertAccessibleRoute(page, '/permissions?lang=en');
  await assertAccessibleRoute(page, '/flight-recorder?lang=en');
  expect(consoleErrors).toEqual([]);
});
