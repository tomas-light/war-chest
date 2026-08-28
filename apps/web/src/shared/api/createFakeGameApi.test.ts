import 'fake-indexeddb/auto';
import {
  type FakeDatabase,
  createFakeDatabase,
  deleteFakeDatabase,
  FAKE_SEED_IDENTIFIERS,
} from '@war-chest/fake-database';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeGameApi } from './createFakeGameApi';
import { getFakeDatabase } from './getFakeDatabase';

vi.mock('./getFakeDatabase', { spy: true });

const CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000001';
const FIRST_JOIN_COMMAND_ID = '30000000-0000-4000-8000-000000000002';
const SECOND_JOIN_COMMAND_ID = '30000000-0000-4000-8000-000000000003';
const MOVE_COMMAND_ID = '30000000-0000-4000-8000-000000000004';
const START_COMMAND_ID = '30000000-0000-4000-8000-000000000005';
const SWAP_COMMAND_ID = '30000000-0000-4000-8000-000000000006';
const SECOND_CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000007';
const THIRD_JOIN_COMMAND_ID = '30000000-0000-4000-8000-000000000008';

describe('fake game API lifecycle', () => {
  let database: FakeDatabase;
  let databaseName: string;

  beforeEach(async () => {
    databaseName = `war-chest-game-api-${crypto.randomUUID()}`;
    database = await createFakeDatabase({ name: databaseName });
    vi.mocked(getFakeDatabase).mockResolvedValue(database);
  });

  afterEach(async () => {
    database.close();
    await deleteFakeDatabase({ name: databaseName });
    vi.restoreAllMocks();
  });

  test('creates a waiting game without occupying a position', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);

    const createdGame = await gameApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });

    expect(createdGame.view).toMatchObject({
      lastEventSequence: 1,
      players: [],
      status: 'waiting',
    });
  });

  test('lets a second user join the free team position', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const secondPlayerApi = createFakeGameApi(
      FAKE_SEED_IDENTIFIERS.telegramUser
    );
    const createdGame = await creatorApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });

    const joinedGame = await secondPlayerApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });

    expect(joinedGame.view).toMatchObject({
      lastEventSequence: 2,
      players: [{ id: FAKE_SEED_IDENTIFIERS.telegramUser, team: 'black' }],
      status: 'waiting',
    });
  });

  test('lets a joined player move to the remaining free position', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const createdGame = await gameApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });
    const joinedGame = await gameApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });

    const movedGame = await gameApi.joinGame(createdGame.gameId, {
      commandId: MOVE_COMMAND_ID,
      expectedVersion: joinedGame.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });

    expect(movedGame.view).toMatchObject({
      lastEventSequence: 3,
      players: [{ id: FAKE_SEED_IDENTIFIERS.googleUser, team: 'black' }],
      teams: { black: [FAKE_SEED_IDENTIFIERS.googleUser], white: [] },
    });
  });

  test('lets the creator start without occupying a position', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const firstPlayerApi = createFakeGameApi(
      FAKE_SEED_IDENTIFIERS.telegramUser
    );
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.yandexUser);
    const createdGame = await creatorApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });
    const firstPlayerJoinedGame = await firstPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: FIRST_JOIN_COMMAND_ID,
        expectedVersion: createdGame.view.lastEventSequence,
        seat: 1,
        team: 'white',
      }
    );
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: firstPlayerJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );

    const startedGame = await creatorApi.startGame(createdGame.gameId, {
      commandId: START_COMMAND_ID,
      expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
    });

    expect(startedGame.view).toMatchObject({
      creatorId: FAKE_SEED_IDENTIFIERS.googleUser,
      lastEventSequence: 4,
      privateMoves: [],
      status: 'active',
    });
  });

  test('rejects start from a joined player who is not the creator', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const secondPlayerApi = createFakeGameApi(
      FAKE_SEED_IDENTIFIERS.telegramUser
    );
    const createdGame = await creatorApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });
    const creatorJoinedGame = await creatorApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: creatorJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );
    await expect(
      secondPlayerApi.startGame(createdGame.gameId, {
        commandId: START_COMMAND_ID,
        expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
      })
    ).rejects.toThrow('Только создатель может запустить игру.');
  });

  test('lets the creator swap both occupied positions', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const secondPlayerApi = createFakeGameApi(
      FAKE_SEED_IDENTIFIERS.telegramUser
    );
    const createdGame = await creatorApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });
    const creatorJoinedGame = await creatorApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: creatorJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );

    const swappedGame = await creatorApi.swapPlayerPositions(
      createdGame.gameId,
      {
        commandId: SWAP_COMMAND_ID,
        expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
      }
    );

    expect(swappedGame.view.players).toEqual([
      expect.objectContaining({
        id: FAKE_SEED_IDENTIFIERS.googleUser,
        team: 'black',
      }),
      expect.objectContaining({
        id: FAKE_SEED_IDENTIFIERS.telegramUser,
        team: 'white',
      }),
    ]);
  });

  test('does not create another game for a current player', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const createdGame = await gameApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });
    await gameApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });

    await expect(
      gameApi.createGame({ commandId: SECOND_CREATE_COMMAND_ID })
    ).rejects.toThrow('Сначала завершите текущую игру.');
  });

  test('does not join a second game for a current player', async () => {
    const firstGameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const secondGameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.telegramUser);
    const firstGame = await firstGameApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });
    await firstGameApi.joinGame(firstGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: firstGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondGame = await secondGameApi.createGame({
      commandId: SECOND_CREATE_COMMAND_ID,
    });

    await expect(
      firstGameApi.joinGame(secondGame.gameId, {
        commandId: THIRD_JOIN_COMMAND_ID,
        expectedVersion: secondGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      })
    ).rejects.toThrow('Другие партии можно только смотреть.');
  });

  test('reports the current player game in the lobby', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.googleUser);
    const createdGame = await gameApi.createGame({
      commandId: CREATE_COMMAND_ID,
    });
    await gameApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });

    const lobby = await gameApi.listLobbyGames();

    expect(lobby.currentPlayerGameId).toBe(createdGame.gameId);
  });
});
