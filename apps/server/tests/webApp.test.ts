import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Auth } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import { expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';

test('serves the SPA entry point for a deep link navigation', async () => {
  const webAssetsRoot = await mkdtemp(join(tmpdir(), 'war-chest-web-'));
  await writeFile(join(webAssetsRoot, 'index.html'), '<h1>War Chest</h1>');
  const databaseConnection = {
    checkConnection: vi.fn(),
    close: vi.fn(),
  } as unknown as DatabaseConnection;
  const app = createApp({
    auth: {} as Auth,
    databaseConnection,
    logger: false,
    webAssetsRoot,
  });

  try {
    const response = await app.inject({
      headers: { accept: 'text/html' },
      method: 'GET',
      url: '/games/game-1',
    });

    expect(response.body).toBe('<h1>War Chest</h1>');
    expect(response.headers['cache-control']).toBe('no-cache');
  } finally {
    await app.close();
    await rm(webAssetsRoot, { recursive: true });
  }
});

test('does not use the SPA fallback for an unknown API route', async () => {
  const webAssetsRoot = await mkdtemp(join(tmpdir(), 'war-chest-web-'));
  await writeFile(join(webAssetsRoot, 'index.html'), '<h1>War Chest</h1>');
  const databaseConnection = {
    checkConnection: vi.fn(),
    close: vi.fn(),
  } as unknown as DatabaseConnection;
  const app = createApp({
    auth: {} as Auth,
    databaseConnection,
    logger: false,
    webAssetsRoot,
  });

  try {
    const response = await app.inject({
      headers: { accept: 'text/html' },
      method: 'GET',
      url: '/api/unknown',
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'not_found',
        message: 'Resource was not found.',
      },
    });
  } finally {
    await app.close();
    await rm(webAssetsRoot, { recursive: true });
  }
});
