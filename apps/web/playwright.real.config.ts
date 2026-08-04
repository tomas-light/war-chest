import { defineConfig, devices } from '@playwright/test';

const WEB_BASE_URL = 'http://127.0.0.1:5173';

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  projects: [
    {
      name: 'e2e-real',
      testDir: './tests/e2e/real',
      testMatch: '**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: WEB_BASE_URL },
    },
  ],
  reporter: process.env.CI ? 'github' : 'list',
  retries: process.env.CI ? 1 : 0,
  webServer: [
    {
      command: 'yarn dev',
      reuseExistingServer: !process.env.CI,
      url: WEB_BASE_URL,
    },
    {
      command: 'yarn workspace @war-chest/server dev',
      reuseExistingServer: !process.env.CI,
      url: 'http://127.0.0.1:3000/api/health',
    },
  ],
});
