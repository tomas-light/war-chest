import type { Auth } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import { expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';

test('reports ready when the database connection is healthy', async () => {
  const checkConnection = vi.fn(
    async function checkConnection(): Promise<void> {
      return Promise.resolve();
    }
  );
  const close = vi.fn(async function close(): Promise<void> {
    return Promise.resolve();
  });
  const databaseConnection = {
    checkConnection,
    close,
  } as unknown as DatabaseConnection;
  const app = createApp({
    auth: {} as Auth,
    databaseConnection,
    disconnectedPlayerTimeoutMinutes: 15,
    featureFlagsService: { read: vi.fn() },
  });

  try {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect({ body: response.body, statusCode: response.statusCode }).toEqual({
      body: '{"status":"ok"}',
      statusCode: 200,
    });
  } finally {
    await app.close();
  }
});

test('reports unavailable when the database health check fails', async () => {
  const checkConnection = vi.fn(
    async function checkConnection(): Promise<void> {
      return Promise.reject(new Error('Database is unavailable'));
    }
  );
  const close = vi.fn(async function close(): Promise<void> {
    return Promise.resolve();
  });
  const databaseConnection = {
    checkConnection,
    close,
  } as unknown as DatabaseConnection;
  const app = createApp({
    auth: {} as Auth,
    databaseConnection,
    disconnectedPlayerTimeoutMinutes: 15,
    featureFlagsService: { read: vi.fn() },
  });

  try {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect({ body: response.body, statusCode: response.statusCode }).toEqual({
      body: '{"status":"unavailable"}',
      statusCode: 503,
    });
  } finally {
    await app.close();
  }
});

test('closes the database connection with the application', async () => {
  const checkConnection = vi.fn(
    async function checkConnection(): Promise<void> {
      return Promise.resolve();
    }
  );
  const close = vi.fn(async function close(): Promise<void> {
    return Promise.resolve();
  });
  const databaseConnection = {
    checkConnection,
    close,
  } as unknown as DatabaseConnection;
  const app = createApp({
    auth: {} as Auth,
    databaseConnection,
    disconnectedPlayerTimeoutMinutes: 15,
    featureFlagsService: { read: vi.fn() },
  });

  await app.close();

  expect(close).toHaveBeenCalledOnce();
});
