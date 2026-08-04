import { expect, test, vi } from 'vitest';
import { startServer } from '../src/start-server.js';

const mocks = vi.hoisted(() => ({
  createAuth: vi.fn(),
  createDatabase: vi.fn(),
  loadServerConfig: vi.fn(),
}));

vi.mock('@war-chest/auth', () => ({
  createAuth: mocks.createAuth,
}));

vi.mock('@war-chest/database', () => ({
  createDatabase: mocks.createDatabase,
}));

vi.mock('../src/config/index.js', () => ({
  loadServerConfig: mocks.loadServerConfig,
}));

test('explains how to start PostgreSQL when it is unavailable', async () => {
  const close = vi.fn(async function close(): Promise<void> {
    return Promise.resolve();
  });
  const checkConnection = vi.fn(
    async function checkConnection(): Promise<void> {
      return Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:5432'));
    }
  );

  mocks.loadServerConfig.mockReturnValue({
    APP_HOST: '127.0.0.1',
    APP_PORT: 3000,
    DISCONNECTED_PLAYER_TIMEOUT_MINUTES: 15,
    FEATURE_FLAGS_RUNTIME_FILE: 'feature-flags.json',
  });
  mocks.createDatabase.mockReturnValue({
    checkConnection,
    close,
    database: {},
  });
  mocks.createAuth.mockReturnValue({});

  await expect(startServer()).rejects.toThrow(
    'PostgreSQL is unavailable. Check packages/database/env.yaml and make sure the database is running. For local development, run "yarn db:up" and then "yarn db:migrate" before starting the server.'
  );
});
