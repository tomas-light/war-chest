import {
  type RuntimeFeatureFlags,
  runtimeFeatureFlagsSchema,
} from '@war-chest/feature-flags';
import type { BackendKind } from '../config';
import {
  ApiClientError,
  createResponseError,
  requestApi,
} from './ApiClientError';

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
  const response = await requestApi('/api/config/feature-flags.json', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw await createResponseError(response);
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch (error) {
    throw new ApiClientError({
      cause: error,
      code: 'invalid_response',
      diagnosticMessage: 'The server returned invalid feature flags.',
    });
  }

  const result = runtimeFeatureFlagsSchema.safeParse(responseBody);

  if (!result.success) {
    throw new ApiClientError({
      code: 'invalid_response',
      diagnosticMessage: 'The server returned invalid feature flags.',
    });
  }

  return result.data;
}
