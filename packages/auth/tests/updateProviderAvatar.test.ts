import type { Database } from '@war-chest/database';
import sharp from 'sharp';
import { afterEach, expect, test, vi } from 'vitest';
import { updateProviderAvatar } from '../src/avatars.js';
import type { AuthConfig } from '../src/config/index.js';

const AVATAR_CONFIG = {
  AUTH_AVATAR_FETCH_TIMEOUT_MS: 5000,
  AUTH_AVATAR_MAX_SOURCE_BYTES: 1048576,
  AUTH_AVATAR_SIZE_PX: 256,
} satisfies Partial<AuthConfig>;

const AUTH_CONFIG = AVATAR_CONFIG as AuthConfig;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('logs when the provider returned no avatar URL', async () => {
  const consoleWarning = vi
    .spyOn(console, 'warn')
    .mockImplementation(() => undefined);

  const avatarHash = await updateProviderAvatar({
    avatarUrl: undefined,
    config: AUTH_CONFIG,
    database: {} as Database,
    existingAvatarHash: null,
    provider: 'google',
    userId: 'user-one',
  });

  expect(avatarHash).toBeNull();
  expect(consoleWarning).toHaveBeenCalledWith(
    'Avatar refresh skipped: provider returned no avatar URL.',
    {
      provider: 'google',
      userId: 'user-one',
    }
  );
});

test('logs safe error details when avatar download cannot start', async () => {
  const consoleError = vi
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);

  const avatarHash = await updateProviderAvatar({
    avatarUrl: 'not-a-url',
    config: AUTH_CONFIG,
    database: {} as Database,
    existingAvatarHash: null,
    provider: 'yandex',
    userId: 'user-two',
  });

  expect(avatarHash).toBeNull();
  expect(consoleError).toHaveBeenCalledWith('Avatar refresh failed.', {
    error: {
      causeCode: null,
      code: 'ERR_INVALID_URL',
      message: 'Invalid URL',
      name: 'TypeError',
    },
    provider: 'yandex',
    stage: 'download_and_normalize',
    userId: 'user-two',
  });
});

test('downloads and stores an avatar from a public IPv4 address', async () => {
  const sourceImage = await sharp({
    create: {
      background: '#283c50',
      channels: 4,
      height: 1,
      width: 1,
    },
  })
    .png()
    .toBuffer();
  const fetchAvatar = vi.fn(() =>
    Promise.resolve(
      new Response(new Uint8Array(sourceImage), {
        headers: { 'Content-Type': 'image/png' },
      })
    )
  );
  const storeAvatar = vi.fn(() => Promise.resolve());
  const database = {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ onConflictDoUpdate: storeAvatar })),
    })),
  } as unknown as Database;

  vi.stubGlobal('fetch', fetchAvatar);

  const avatarHash = await updateProviderAvatar({
    avatarUrl: 'https://87.250.247.181/avatar.png',
    config: AUTH_CONFIG,
    database,
    existingAvatarHash: null,
    provider: 'yandex',
    userId: 'user-three',
  });

  expect(avatarHash).not.toBeNull();
  expect(fetchAvatar).toHaveBeenCalledOnce();
  expect(storeAvatar).toHaveBeenCalledOnce();
});
