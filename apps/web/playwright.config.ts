import { defineConfig, devices } from '@playwright/test';

const COMPONENT_BASE_URL = 'http://127.0.0.1:5174';
const WEB_BASE_URL = 'http://127.0.0.1:5173';

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [
    {
      name: 'components',
      testDir: './src',
      testMatch: '**/*.ctest.tsx',
      use: { ...devices['Desktop Chrome'], baseURL: COMPONENT_BASE_URL },
    },
    {
      name: 'e2e-fake',
      testDir: './tests/e2e/fake',
      testMatch: '**/*.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: WEB_BASE_URL,
        locale: 'ru-RU',
      },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 2 : 0,
  webServer: [
    {
      command: 'yarn vite --config playwright/gallery/vite.config.ts',
      reuseExistingServer: !process.env.CI,
      url: COMPONENT_BASE_URL,
    },
    {
      command: 'yarn dev',
      reuseExistingServer: !process.env.CI,
      url: WEB_BASE_URL,
    },
  ],
});
