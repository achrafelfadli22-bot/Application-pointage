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
