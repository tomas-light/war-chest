import type { Auth } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';
import type { FeatureFlagsService } from '../src/featureFlags/FeatureFlagsService.js';

describe('runtime feature flags route', () => {
  let app: FastifyInstance;
  let read: ReturnType<typeof vi.fn<FeatureFlagsService['read']>>;

  beforeEach(() => {
    read = vi.fn<FeatureFlagsService['read']>();
    const databaseConnection = {
      checkConnection: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseConnection;

    app = createApp({
      auth: {} as Auth,
      databaseConnection,
      disconnectedPlayerTimeoutMinutes: 15,
      featureFlagsService: { read },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('returns the current runtime feature flags', async () => {
    read.mockResolvedValue({ gameHistory: true, spectatorMode: false });

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/feature-flags.json',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      gameHistory: true,
      spectatorMode: false,
    });
  });

  test('reports unavailable when the runtime file cannot be read', async () => {
    read.mockRejectedValue(new Error('Runtime file is missing'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/config/feature-flags.json',
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      error: {
        code: 'feature_flags_unavailable',
        message: 'Feature flags are unavailable.',
      },
    });
  });
});
