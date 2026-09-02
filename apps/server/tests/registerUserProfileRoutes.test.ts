import type { Auth, AuthSession } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';
import {
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

describe('public user profile routes', () => {
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
  test('returns only the public user profile fields', async () => {
    findPublicUser.mockResolvedValue({
      avatarVersion: 'avatar-version',
      displayName: 'Ada',
      id: USER_ID,
    });

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      avatarVersion: 'avatar-version',
      displayName: 'Ada',
      id: USER_ID,
    });
  });

  test('returns 404 when the public profile does not exist', async () => {
    findPublicUser.mockResolvedValue(null);

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'user_not_found',
        message: 'User was not found.',
      },
    });
  });

  test('rejects a malformed user id before querying the repository', async () => {
    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: '/api/users/not-a-uuid',
    });

    expect(response.statusCode).toBe(400);
    expect(findPublicUser).not.toHaveBeenCalled();
  });
});
