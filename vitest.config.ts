import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: import.meta.dirname,
  test: {
    projects: ['packages/*', 'apps/server', 'apps/web/vite.config.ts'],
  },
});
