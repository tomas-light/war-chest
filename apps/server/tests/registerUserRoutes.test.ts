import type { Auth, AuthSession, StoredAvatar } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';
import {
  type UserGamePage,
  type UserRepository,
  createUserRepository,
} from '../src/users/UserRepository.js';

vi.mock('../src/users/UserRepository.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createUserRepository: vi.fn(),
}));

const USER_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '10000000-0000-4000-8000-000000000002';
const GAME_ID = '20000000-0000-4000-8000-000000000001';
const NEXT_GAME_ID = '20000000-0000-4000-8000-000000000002';
const AUTH_HEADERS = { cookie: 'war_chest_session=session-token' };

describe('user profile routes', () => {
  let app: FastifyInstance;
  let findPublicUser: ReturnType<
    typeof vi.fn<UserRepository['findPublicUser']>
  >;
  let getAvatar: ReturnType<typeof vi.fn<Auth['getAvatar']>>;
  let listFinishedGames: ReturnType<
    typeof vi.fn<UserRepository['listFinishedGames']>
  >;

  beforeEach(() => {
    const session: AuthSession = {
      expiresAt: new Date('2026-09-03T10:00:00.000Z'),
      user: {
        avatarHash: null,
        displayName: 'Viewer',
        id: OTHER_USER_ID,
      },
    };
    const getSession = vi.fn<Auth['getSession']>();

    getSession.mockResolvedValue(session);
    getAvatar = vi.fn<Auth['getAvatar']>();
    findPublicUser = vi.fn<UserRepository['findPublicUser']>();
    listFinishedGames = vi.fn<UserRepository['listFinishedGames']>();

    const auth = {
      getAvatar,
      getSession,
      sessionCookieName: 'war_chest_session',
    } as unknown as Auth;
    const databaseConnection = {
      checkConnection: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseConnection;
    const userRepository: UserRepository = {
      findPublicUser,
      listFinishedGames,
    };
    vi.mocked(createUserRepository).mockReturnValue(userRepository);

    app = createApp({
      auth,
      databaseConnection,
      disconnectedPlayerTimeoutMinutes: 15,
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

  test('returns the stored avatar with immutable private caching', async () => {
    const avatar: StoredAvatar = {
      content: Buffer.from('avatar-bytes'),
      contentHash: 'avatar-version',
      contentType: 'image/webp',
    };
    getAvatar.mockResolvedValue(avatar);

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
    getAvatar.mockResolvedValue(null);

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

  test('returns a serialized page of finished player games', async () => {
    findPublicUser.mockResolvedValue({
      avatarVersion: null,
      displayName: 'Ada',
      id: USER_ID,
    });
    const page: UserGamePage = {
      items: [
        {
          finishedAt: new Date('2026-08-04T10:00:00.000Z'),
          id: GAME_ID,
          participants: [
            {
              avatarVersion: null,
              displayName: 'Ada',
              id: USER_ID,
              seat: 1,
              team: 'white',
            },
            {
              avatarVersion: 'grace-avatar',
              displayName: 'Grace',
              id: OTHER_USER_ID,
              seat: 1,
              team: 'black',
            },
          ],
          result: 'victory',
          team: 'white',
          winnerTeam: 'white',
        },
      ],
      nextCursor: {
        finishedAt: new Date('2026-08-04T10:00:00.000Z'),
        gameId: GAME_ID,
      },
    };
    listFinishedGames.mockResolvedValue(page);

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}/games`,
    });

    expect(listFinishedGames).toHaveBeenCalledWith(USER_ID, {
      cursor: undefined,
      limit: 20,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      items: [
        {
          ...page.items[0],
          finishedAt: '2026-08-04T10:00:00.000Z',
        },
      ],
      nextCursor: Buffer.from(
        JSON.stringify({
          finishedAt: '2026-08-04T10:00:00.000Z',
          gameId: GAME_ID,
        })
      ).toString('base64url'),
    });
  });

  test('decodes the cursor and custom page limit', async () => {
    findPublicUser.mockResolvedValue({
      avatarVersion: null,
      displayName: 'Ada',
      id: USER_ID,
    });
    listFinishedGames.mockResolvedValue({ items: [], nextCursor: null });
    const cursor = Buffer.from(
      JSON.stringify({
        finishedAt: '2026-08-03T10:00:00.000Z',
        gameId: NEXT_GAME_ID,
      })
    ).toString('base64url');

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}/games?cursor=${cursor}&limit=5`,
    });

    expect(response.statusCode).toBe(200);
    expect(listFinishedGames).toHaveBeenCalledWith(USER_ID, {
      cursor: {
        finishedAt: new Date('2026-08-03T10:00:00.000Z'),
        gameId: NEXT_GAME_ID,
      },
      limit: 5,
    });
  });

  test('rejects an invalid history cursor', async () => {
    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}/games?cursor=invalid`,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'invalid_cursor',
        message: 'History cursor is invalid.',
      },
    });
    expect(listFinishedGames).not.toHaveBeenCalled();
  });

  test('returns 404 when history is requested for an unknown user', async () => {
    findPublicUser.mockResolvedValue(null);

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/users/${USER_ID}/games`,
    });

    expect(response.statusCode).toBe(404);
    expect(listFinishedGames).not.toHaveBeenCalled();
  });
});
