import {
  type RuntimeFeatureFlags,
  runtimeFeatureFlagsSchema,
} from '@war-chest/feature-flags';
import type { BackendKind } from '#/shared/config';

export function readFeatureFlags(
  backend: BackendKind
): Promise<RuntimeFeatureFlags> {
  if (import.meta.env.DEV && backend === 'fake') {
    return readFakeFeatureFlags();
  }

  return readRealFeatureFlags();
}

async function readFakeFeatureFlags(): Promise<RuntimeFeatureFlags> {
  const { getFakeDatabase } = await import('./getFakeDatabase');
  const database = await getFakeDatabase();

  return database.featureFlags.getApplication();
}

async function readRealFeatureFlags() {
  const response = await fetch('/api/config/feature-flags.json', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `Feature flags request failed with status ${response.status}.`
    );
  }

  const responseBody: unknown = await response.json();
  const result = runtimeFeatureFlagsSchema.safeParse(responseBody);

  if (!result.success) {
    throw new Error('The server returned invalid feature flags.');
  }

  return result.data;
}
