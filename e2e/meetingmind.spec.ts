import { test, expect, type Page } from '@playwright/test';

const PHONE = { width: 390, height: 844 };

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page is wider than the viewport').toBeLessThanOrEqual(1);
}

test('load sample, analyse, mark an action done, then find the meeting by search', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load sample' }).click();
  await expect(page.locator('#transcript')).not.toHaveValue('');

  await page.getByRole('button', { name: 'Analyse meeting' }).click();

  const result = page.getByRole('region', { name: 'Result' });
  await expect(result.getByText(/^(AI|Rule-based)$/)).toBeVisible();
  await expect(result.getByRole('heading', { name: 'Summary' })).toBeVisible();
  await expect(result.getByRole('heading', { name: 'Decisions' })).toBeVisible();

  const table = result.getByRole('table');
  const rows = table.getByRole('row');
  await expect(rows.nth(1)).toBeVisible();
  expect(await rows.count(), 'header row plus at least two action items').toBeGreaterThanOrEqual(3);

  await table.getByRole('button', { name: 'Mark done' }).first().click();
  await expect(table.getByText('Done', { exact: true })).toBeVisible();

  await page.goto('/meetings');
  await page.getByRole('searchbox').fill('retention wording');
  const row = page.getByTestId('meeting-row').filter({ hasText: 'Tidewell 2.0 beta scoping' }).first();
  await expect(row).toBeVisible();

  await row.getByRole('link', { name: 'Tidewell 2.0 beta scoping' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tidewell 2.0 beta scoping' })).toBeVisible();
  await expect(page.getByRole('table').getByText('Done', { exact: true })).toBeVisible();
});

test('the app shows seeded meetings on first visit', async ({ page }) => {
  await page.goto('/meetings');
  await expect(page.getByTestId('meeting-row').first()).toBeVisible();
  expect(await page.getByTestId('meeting-row').count()).toBeGreaterThanOrEqual(4);
});

test('analyse button and counter enforce the 8,000 character limit', async ({ page }) => {
  await page.goto('/');
  const analyse = page.getByRole('button', { name: 'Analyse meeting' });
  await expect(analyse).toBeDisabled();

  await page.locator('#transcript').fill('a'.repeat(8001));
  await expect(page.locator('#transcript-count')).toHaveText('8,001 / 8,000');
  await expect(analyse).toBeDisabled();

  await page.locator('#transcript').fill('a'.repeat(8000));
  await expect(analyse).toBeEnabled();
});

test('a meeting can be deleted from its page', async ({ page }) => {
  const title = `E2E delete ${Date.now()}`;
  await page.goto('/');
  await page.getByLabel('Meeting title').fill(title);
  await page.locator('#transcript').fill('Priya: We will ship the new export on Monday.');
  await page.getByRole('button', { name: 'Analyse meeting' }).click();
  await expect(page.getByRole('region', { name: 'Result' }).getByText(title)).toBeVisible();

  await page.getByRole('link', { name: 'Open saved meeting' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Delete meeting' }).click();
  await page.getByRole('button', { name: 'Yes, delete this meeting' }).click();

  await expect(page).toHaveURL(/\/meetings$/);
  await page.getByRole('searchbox').fill(title);
  await expect(page.getByText(`No meetings match “${title}”`)).toBeVisible();
});

test('action items board splits open and done and toggles an item', async ({ page }) => {
  await page.goto('/action-items');
  const open = page.getByRole('region', { name: 'Open' });
  const done = page.getByRole('region', { name: 'Done' });
  await expect(open).toBeVisible();
  await expect(done).toBeVisible();

  const openButton = open.getByRole('button', { name: 'Mark done' }).first();
  await expect(openButton).toBeVisible();
  const card = openButton.locator('xpath=ancestor::li[1]');
  const task = (await card.locator('.item-task').textContent())?.trim() ?? '';
  expect(task.length).toBeGreaterThan(0);

  await openButton.click();
  await expect(done.getByText(task, { exact: true })).toBeVisible();
  await done.getByText(task, { exact: true }).locator('xpath=ancestor::li[1]').getByRole('button', { name: 'Reopen' }).click();
  await expect(open.getByText(task, { exact: true })).toBeVisible();
});

test('theme toggle switches to dark and remembers the choice', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toggle light and dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe('rgb(12, 16, 24)');
});

test.describe('phone width (390px)', () => {
  test.use({ viewport: PHONE });

  for (const path of ['/', '/meetings', '/action-items']) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page);
    });
  }

  test('no horizontal scroll with an analysed meeting and its action table', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Load sample' }).click();
    await page.getByRole('button', { name: 'Analyse meeting' }).click();
    await expect(page.getByRole('region', { name: 'Result' }).getByRole('table')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('no horizontal scroll on a meeting page', async ({ page }) => {
    await page.goto('/meetings');
    await expect(page.getByTestId('meeting-row').first()).toBeVisible();
    await page.getByTestId('meeting-row').first().getByRole('link').first().click();
    await expect(page.getByRole('table')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
