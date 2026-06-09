import { expect, Page, test } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api';
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password123!';
const RESOURCE_MANAGER_EMAIL = 'a.elyoussefi@futura-expert.com';

async function waitForApi() {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/health/live`);
      if (response.ok) {
        return;
      }
    } catch {
      // The runner may still be starting the API.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`API is unavailable on ${API_URL}`);
}

async function loginUi(page: Page, email = RESOURCE_MANAGER_EMAIL) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /^mot de passe$/i }).fill(PASSWORD);
  await page.getByRole('button', { name: /connect/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test.beforeAll(async () => {
  await waitForApi();
});

test('protected pages redirect anonymous users to login before rendering app data', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await expect(page.getByRole('heading', { name: /connexion/i })).toBeVisible();
  await expect(page.getByText(/tableau de bord/i)).toHaveCount(0);
});

test('resource manager can log in and open dashboard', async ({ page }) => {
  await loginUi(page);
  await expect(page.getByRole('banner').getByText(/Abdelouahed El Youssefi/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Timesheets', exact: true })).toBeVisible();
});

test('authenticated resource manager can open timesheets', async ({ page }) => {
  await loginUi(page);
  await page.getByRole('link', { name: 'Timesheets', exact: true }).click();
  await expect(page).toHaveURL(/\/timesheets/);
  await expect(page.getByRole('heading', { name: /^timesheets$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /nouvelle timesheet/i })).toBeVisible();
});

test('timesheet status filters are clickable and keep the list usable', async ({ page }) => {
  await loginUi(page);
  await page.getByRole('link', { name: 'Timesheets', exact: true }).click();

  const draftFilter = page.getByRole('button', { name: /brouillon/i });
  await draftFilter.click();
  await expect(draftFilter).toHaveClass(/bg-accentLight/);
  await expect(page.getByRole('table')).toBeVisible();

  const allFilter = page.getByRole('button', { name: /toutes/i });
  await allFilter.click();
  await expect(allFilter).toHaveClass(/bg-accentLight/);
  await expect(page.getByRole('button', { name: /nouvelle timesheet/i })).toBeVisible();
});

test('new timesheet modal exposes resource and configured period fields', async ({ page }) => {
  await loginUi(page);
  await page.getByRole('link', { name: 'Timesheets', exact: true }).click();
  await page.getByRole('button', { name: /nouvelle timesheet/i }).click();

  const dialog = page.getByRole('dialog', { name: /nouvelle timesheet/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/ressource/i)).toBeVisible();
  await expect(dialog.getByText(/mensuelle|hebdomadaire/i)).toBeVisible();
  await expect(dialog.locator('input[type="date"]')).toHaveCount(2);

  await dialog.locator('input[type="date"]').first().fill('2026-06-01');
  await expect(dialog.locator('input[type="date"]').nth(1)).not.toHaveValue('');
});
