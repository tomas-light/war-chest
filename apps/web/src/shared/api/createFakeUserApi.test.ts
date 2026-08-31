import type { FakeDatabase, FakeUser } from '@war-chest/fake-database';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeUserApi } from './createFakeUserApi';
import { getFakeDatabase } from './getFakeDatabase';

vi.mock('./getFakeDatabase', () => ({ getFakeDatabase: vi.fn() }));

describe('fake user API', () => {
  let getGameParticipant: ReturnType<typeof vi.fn>;
  let getUserById: ReturnType<typeof vi.fn<FakeDatabase['users']['getById']>>;
  let listGamesForUser: ReturnType<typeof vi.fn>;
  let listGameParticipants: ReturnType<typeof vi.fn>;
  let saveUser: ReturnType<typeof vi.fn>;
  let user: FakeUser;

  beforeEach(() => {
    user = {
      avatarDataUrl: null,
      avatarPresetId: 'archer',
      createdAt: new Date('2026-08-31T12:00:00.000Z'),
      displayName: 'Player One',
      email: 'player@example.com',
      id: '10000000-0000-4000-8000-000000000010',
    };
    getGameParticipant = vi.fn();
    getUserById = vi
      .fn<FakeDatabase['users']['getById']>()
      .mockResolvedValue(user);
    listGamesForUser = vi.fn().mockResolvedValue([]);
    listGameParticipants = vi.fn().mockResolvedValue([]);
    saveUser = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getFakeDatabase).mockResolvedValue({
      games: {
        getParticipant: getGameParticipant,
        listGamesForUser,
        listParticipants: listGameParticipants,
      },
      users: {
        findByEmail: vi.fn(),
        getById: getUserById,
        save: saveUser,
      },
    } as unknown as FakeDatabase);
  });

  test('selects an avatar preset for the authenticated fake user', async () => {
    const userApi = createFakeUserApi(user.id);

    const result = await userApi.selectAvatarPreset('cavalry');

    expect(result.avatarVersion).toBe('preset:cavalry');
    expect(saveUser).toHaveBeenCalledWith({
      ...user,
      avatarDataUrl: null,
      avatarPresetId: 'cavalry',
    });
  });

  test('returns another fake user public profile', async () => {
    const otherUser: FakeUser = {
      ...user,
      avatarPresetId: 'cavalry',
      displayName: 'Player Two',
      email: 'player-two@example.com',
      id: '10000000-0000-4000-8000-000000000011',
    };
    getUserById.mockResolvedValue(otherUser);
    const userApi = createFakeUserApi(user.id);

    const result = await userApi.getPublicUser(otherUser.id);

    expect(result).toEqual({
      avatarVersion: 'preset:cavalry',
      displayName: 'Player Two',
      id: otherUser.id,
    });
  });

  test('returns finished fake games with participants and user result', async () => {
    const otherUser: FakeUser = {
      ...user,
      avatarPresetId: 'cavalry',
      displayName: 'Player Two',
      email: 'player-two@example.com',
      id: '10000000-0000-4000-8000-000000000011',
    };
    const gameId = '20000000-0000-4000-8000-000000000010';
    const finishedAt = new Date('2026-08-31T15:00:00.000Z');
    const currentParticipant = {
      gameId,
      seat: 1,
      team: 'black' as const,
      userId: user.id,
    };
    const otherParticipant = {
      gameId,
      seat: 1,
      team: 'white' as const,
      userId: otherUser.id,
    };

    listGamesForUser.mockResolvedValue([
      {
        createdAt: new Date('2026-08-31T14:00:00.000Z'),
        currentVersion: 8,
        finishedAt,
        id: gameId,
        startedAt: new Date('2026-08-31T14:05:00.000Z'),
        status: 'finished',
        winnerTeam: 'white',
      },
      {
        createdAt: new Date('2026-08-31T16:00:00.000Z'),
        currentVersion: 1,
        finishedAt: null,
        id: '20000000-0000-4000-8000-000000000011',
        startedAt: null,
        status: 'waiting',
        winnerTeam: null,
      },
    ]);
    getGameParticipant.mockResolvedValue(currentParticipant);
    listGameParticipants.mockResolvedValue([
      currentParticipant,
      otherParticipant,
    ]);
    getUserById.mockImplementation((userId: string) =>
      Promise.resolve(userId === user.id ? user : otherUser)
    );
    const userApi = createFakeUserApi(user.id);

    const result = await userApi.listFinishedGames(user.id);

    expect(result).toEqual({
      items: [
        {
          finishedAt: finishedAt.toISOString(),
          id: gameId,
          participants: [
            {
              avatarVersion: 'preset:archer',
              displayName: user.displayName,
              id: user.id,
              seat: 1,
              team: 'black',
            },
            {
              avatarVersion: 'preset:cavalry',
              displayName: otherUser.displayName,
              id: otherUser.id,
              seat: 1,
              team: 'white',
            },
          ],
          result: 'defeat',
          team: 'black',
          winnerTeam: 'white',
        },
      ],
      nextCursor: null,
    });
  });

  test('updates the fake user nickname', async () => {
    const userApi = createFakeUserApi(user.id);

    const result = await userApi.updateDisplayName('New Name');

    expect(result.displayName).toBe('New Name');
    expect(saveUser).toHaveBeenCalledWith({
      ...user,
      displayName: 'New Name',
    });
  });

  test('stores a custom avatar for the fake user', async () => {
    const userApi = createFakeUserApi(user.id);
    const dataUrl = 'data:image/png;base64,aW1hZ2U=';

    const result = await userApi.uploadAvatar(dataUrl);

    expect(result.avatarVersion).toBe(dataUrl);
    expect(saveUser).toHaveBeenCalledWith({
      ...user,
      avatarDataUrl: dataUrl,
      avatarPresetId: null,
    });
  });

  test('removes the fake user avatar', async () => {
    const userApi = createFakeUserApi(user.id);

    const result = await userApi.removeAvatar();

    expect(result.avatarVersion).toBeNull();
    expect(saveUser).toHaveBeenCalledWith({
      ...user,
      avatarDataUrl: null,
      avatarPresetId: null,
    });
  });
});
