import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { FakeBackendClient } from './createFakeBackendClient';
import { getFakeBackendClient } from './getFakeBackendClient';
import { readFeatureFlags } from './readFeatureFlags';

vi.mock('./getFakeBackendClient', () => ({ getFakeBackendClient: vi.fn() }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('real runtime feature flags', () => {
  test('reads boolean feature flags from the server', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      Response.json({
        ...DEFAULT_RUNTIME_FEATURE_FLAGS,
        spectatorMode: false,
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(readFeatureFlags('real')).resolves.toEqual({
      ...DEFAULT_RUNTIME_FEATURE_FLAGS,
      spectatorMode: false,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/config/feature-flags.json', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  });

  test('rejects a non-boolean feature flag value', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      Response.json({
        ...DEFAULT_RUNTIME_FEATURE_FLAGS,
        spectatorMode: 'enabled',
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(readFeatureFlags('real')).rejects.toThrow(
      'The server returned invalid feature flags.'
    );
  });
});

describe('fake runtime feature flags', () => {
  test('reads feature flags from the fake backend client', async () => {
    const readFakeFeatureFlags = vi.fn<FakeBackendClient['readFeatureFlags']>();
    const backendClient = {
      readFeatureFlags: readFakeFeatureFlags,
    } as unknown as FakeBackendClient;

    readFakeFeatureFlags.mockResolvedValue(DEFAULT_RUNTIME_FEATURE_FLAGS);
    vi.mocked(getFakeBackendClient).mockReturnValue(backendClient);

    await expect(readFeatureFlags('fake')).resolves.toEqual(
      DEFAULT_RUNTIME_FEATURE_FLAGS
    );
    expect(readFakeFeatureFlags).toHaveBeenCalledOnce();
  });
});
