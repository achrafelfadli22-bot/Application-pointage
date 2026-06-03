import { defineConfig, devices } from '@playwright/test';

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEB_SERVER === 'true';
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? (!process.env.CI && process.platform === 'win32' ? 'chrome' : undefined);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: `${pnpm} dev`,
        url: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], ...(browserChannel ? { channel: browserChannel } : {}) },
    },
  ],
});
