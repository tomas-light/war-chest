import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createFeatureFlagsService } from '../src/featureFlags/FeatureFlagsService.js';

describe('runtime feature flags service', () => {
  let runtimeDirectory: string;
  let runtimeFile: string;

  beforeEach(async () => {
    runtimeDirectory = await mkdtemp(join(tmpdir(), 'war-chest-flags-'));
    runtimeFile = join(runtimeDirectory, 'feature-flags.json');
  });

  afterEach(async () => {
    await rm(runtimeDirectory, { recursive: true });
  });

  test('reads boolean flags from the runtime file', async () => {
    await writeFile(
      runtimeFile,
      JSON.stringify({ gameHistory: true, spectatorMode: false })
    );
    const service = createFeatureFlagsService(runtimeFile);

    await expect(service.read()).resolves.toEqual({
      gameHistory: true,
      spectatorMode: false,
    });
  });

  test('reads the runtime file again for every call', async () => {
    await writeFile(runtimeFile, JSON.stringify({ gameHistory: false }));
    const service = createFeatureFlagsService(runtimeFile);
    await service.read();

    await writeFile(runtimeFile, JSON.stringify({ gameHistory: true }));

    await expect(service.read()).resolves.toEqual({ gameHistory: true });
  });

  test('rejects non-boolean flag values', async () => {
    await writeFile(runtimeFile, JSON.stringify({ maximumPlayers: 2 }));
    const service = createFeatureFlagsService(runtimeFile);

    await expect(service.read()).rejects.toThrow();
  });
});
