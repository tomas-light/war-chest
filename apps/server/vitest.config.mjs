import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    setupFiles: ['./tests/setup.ts'],
  },
});
