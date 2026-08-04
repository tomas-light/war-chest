import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { loadWebConfig } from './config/loadWebConfig.js';

const WEB_ROOT = import.meta.dirname;
const SERVER_PROXY = {
  '/api/socket.io': {
    target: 'http://localhost:3000',
    ws: true,
  },
  '/api': {
    target: 'http://localhost:3000',
  },
};

export default defineConfig({
  build: {
    outDir: 'dist',
  },
  define: {
    __WEB_CONFIG__: JSON.stringify(loadWebConfig()),
  },
  plugins: [react()],
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: SERVER_PROXY,
    strictPort: true,
  },
  resolve: {
    alias: {
      '#': resolve(WEB_ROOT, 'src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: SERVER_PROXY,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    name: 'web',
  },
});
