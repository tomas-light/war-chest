import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const WEB_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '#': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  root: fileURLToPath(new URL('.', import.meta.url)),
  server: {
    fs: { allow: [WEB_ROOT] },
    host: '0.0.0.0',
    port: 5174,
  },
});
