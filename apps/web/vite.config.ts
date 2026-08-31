import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import readableClassnames from 'vite-plugin-readable-classnames';
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

const loadedConfig = loadWebConfig();
const { __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS } = loadedConfig;

const SERVER_ALLOWED_HOSTS =
  __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS === ''
    ? []
    : [__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS];

export default defineConfig({
  build: {
    target: 'baseline-widely-available',
    outDir: 'dist',
  },
  define: {
    __WEB_CONFIG__: JSON.stringify({}),
  },
  plugins: [react(), readableClassnames()],
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
    allowedHosts: SERVER_ALLOWED_HOSTS,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    name: 'web',
  },
});
