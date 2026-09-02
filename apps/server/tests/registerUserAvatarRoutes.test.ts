import type { Auth, AuthSession } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';
import {
  type StoredAvatar,
  type UserRepository,
  createUserRepository,
} from '../src/users/UserRepository.js';

vi.mock('../src/users/UserRepository.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createUserRepository: vi.fn(),
}));

const USER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '10000000-0000-4000-8000-000000000002';
const AUTH_HEADERS = { cookie: 'war_chest_session=session-token' };

describe('user avatar routes', () => {
  let app: FastifyInstance;
  let findPublicUser: ReturnType<
    typeof vi.fn<UserRepository['findPublicUser']>
  >;
  let findAvatar: ReturnType<typeof vi.fn<UserRepository['findAvatar']>>;
  let listFinishedGames: ReturnType<
    typeof vi.fn<UserRepository['listFinishedGames']>
  >;

  beforeEach(() => {
    const session: AuthSession = {
      expiresAt: new Date('2026-09-03T10:00:00.000Z'),
      user: {
        avatarVersion: null,
        displayName: 'Viewer',
        id: OTHER_USER_ID,
      },
    };
    const getSession = vi.fn<Auth['getSession']>();

    getSession.mockResolvedValue(session);
    findAvatar = vi.fn<UserRepository['findAvatar']>();
    findPublicUser = vi.fn<UserRepository['findPublicUser']>();
    listFinishedGames = vi.fn<UserRepository['listFinishedGames']>();

    const auth = {
      getSession,
      sessionCookieName: 'war_chest_session',
    } as unknown as Auth;
    const databaseConnection = {
      checkConnection: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseConnection;
    const userRepository: UserRepository = {
      findAvatar,
      findPublicUser,
      listFinishedGames,
      removeAvatar: vi.fn(),
      saveAvatar: vi.fn(),
      selectAvatarPreset: vi.fn(),
      updateDisplayName: vi.fn(),
    };
    vi.mocked(createUserRepository).mockReturnValue(userRepository);

    app = createApp({
      auth,
      databaseConnection,
      disconnectedPlayerTimeoutMinutes: 15,
      emptyWaitingGameTimeoutMinutes: 10,
      featureFlagsService: { read: vi.fn() },
    });
  });

  afterEach(async () => {
    await app.close();
  });
  test('returns the stored avatar with immutable private caching', async () => {
    const avatar: StoredAvatar = {
      content: Buffer.from('avatar-bytes'),
      contentHash: 'avatar-version',
      contentType: 'image/webp',
      kind: 'custom',
    };
    findAvatar.mockResolvedValue(avatar);

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}/avatar?v=avatar-version`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe(
      'private, max-age=31536000, immutable'
    );
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.rawPayload).toEqual(avatar.content);
  });

  test('returns 404 when the user has no stored avatar', async () => {
    findAvatar.mockResolvedValue(null);

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}/avatar`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'avatar_not_found',
        message: 'Avatar was not found.',
      },
    });
  });
});
