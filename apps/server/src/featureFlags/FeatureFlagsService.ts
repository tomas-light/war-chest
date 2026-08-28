import { readFile } from 'node:fs/promises';
import {
  type RuntimeFeatureFlags,
  runtimeFeatureFlagsSchema,
} from '@war-chest/feature-flags';

export interface FeatureFlagsService {
  read(this: void): Promise<RuntimeFeatureFlags>;
}

export function createFeatureFlagsService(
  runtimeFile: string
): FeatureFlagsService {
  return { read };

  async function read(): Promise<RuntimeFeatureFlags> {
    const source = await readFile(runtimeFile, 'utf8');
    const value: unknown = JSON.parse(source);

    return runtimeFeatureFlagsSchema.parse(value);
  }
}
