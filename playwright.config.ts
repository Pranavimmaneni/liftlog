import { defineConfig, devices } from '@playwright/test';

/**
 * NFR-COMP-1: Pixel 7 (Chromium) and iPhone 14 (WebKit), each in Paper (light) and Iron (dark).
 * Runs against the production build (`npm run build` first) so the service worker and CSP are real.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'pixel-paper', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'pixel-iron', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
    { name: 'iphone-paper', use: { ...devices['iPhone 14'], colorScheme: 'light' } },
    { name: 'iphone-iron', use: { ...devices['iPhone 14'], colorScheme: 'dark' } },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
