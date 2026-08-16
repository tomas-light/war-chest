import { readFile } from 'node:fs/promises';
import type { FeatureFlags } from '@war-chest/game-engine';
import { z } from 'zod';

const featureFlagsSchema = z.record(z.string(), z.boolean());

export interface FeatureFlagsService {
  read(): Promise<FeatureFlags>;
}

export function createFeatureFlagsService(
  runtimeFile: string
): FeatureFlagsService {
  return { read };

  async function read(): Promise<FeatureFlags> {
    const source = await readFile(runtimeFile, 'utf8');
    const value: unknown = JSON.parse(source);

    return featureFlagsSchema.parse(value);
  }
}
