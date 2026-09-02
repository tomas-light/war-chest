import type { Auth, AuthSession } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import type { GameView } from '@war-chest/game-engine';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';
import {
  type GameService,
  createGameService,
} from '../src/games/GameService.js';

vi.mock('../src/games/GameService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createGameService: vi.fn(),
}));

const USER_ID = '10000000-0000-4000-8000-000000000001';
const GAME_ID = '20000000-0000-4000-8000-000000000001';
const COMMAND_ID = '30000000-0000-4000-8000-000000000001';
const AUTH_HEADERS = { cookie: 'war_chest_session=session-token' };
const WAITING_VIEW: GameView = {
  creatorId: USER_ID,
  currentPlayerId: null,
  featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
  lastEventSequence: 1,
  moveCount: 0,
  players: [],
  privateMoves: [],
  rulesVersion: 1,
  status: 'waiting',
  teams: { black: [], white: [] },
  winnerTeam: null,
};

describe('game command HTTP routes', () => {
  let app: FastifyInstance;
  let createGame: ReturnType<typeof vi.fn<GameService['createGame']>>;
  let executeCommand: ReturnType<typeof vi.fn<GameService['executeCommand']>>;
  let getEvents: ReturnType<typeof vi.fn<GameService['getEvents']>>;
  let getSession: ReturnType<typeof vi.fn<Auth['getSession']>>;
  let getSnapshot: ReturnType<typeof vi.fn<GameService['getSnapshot']>>;
  let listLobbyGames: ReturnType<typeof vi.fn<GameService['listLobbyGames']>>;

  beforeEach(() => {
    const session: AuthSession = {
      expiresAt: new Date('2026-09-03T10:00:00.000Z'),
      user: {
        avatarVersion: null,
        displayName: 'Ada',
        id: USER_ID,
      },
    };
    getSession = vi.fn<Auth['getSession']>();
    getSession.mockResolvedValue(session);
    createGame = vi.fn<GameService['createGame']>();
    executeCommand = vi.fn<GameService['executeCommand']>();
    getEvents = vi.fn<GameService['getEvents']>();
    getSnapshot = vi.fn<GameService['getSnapshot']>();
    getSnapshot.mockResolvedValue({
      gameId: GAME_ID,
      players: [],
      status: 'found',
      view: WAITING_VIEW,
    });
    listLobbyGames = vi.fn<GameService['listLobbyGames']>();
    listLobbyGames.mockResolvedValue({
      currentPlayerGameId: null,
      items: [],
    });
    const gameService: GameService = {
      close: vi.fn(),
      connect: vi.fn(),
      createGame,
      disconnect: vi.fn(),
      executeCommand,
      getEvents,
      getSnapshot,
      listLobbyGames,
      recoverGames: vi.fn(),
      subscribe: vi.fn<GameService['subscribe']>().mockReturnValue(vi.fn()),
      synchronize: vi.fn(),
    };
    const auth = {
      getSession,
      sessionCookieName: 'war_chest_session',
    } as unknown as Auth;
    const databaseConnection = {
      checkConnection: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseConnection;
    vi.mocked(createGameService).mockReturnValue(gameService);

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

  test('executes join with session identity and validated input', async () => {
    executeCommand.mockResolvedValue({
      currentVersion: 2,
      events: [],
      previousVersion: 1,
      status: 'saved',
      view: { ...WAITING_VIEW, lastEventSequence: 2 },
    });

    const response = await app.inject({
      body: {
        commandId: COMMAND_ID,
        expectedVersion: 1,
        seat: 1,
        team: 'white',
      },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: `/api/games/${GAME_ID}/join`,
    });

    expect(executeCommand).toHaveBeenCalledWith({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: USER_ID,
    });
    expect(response.statusCode).toBe(200);
  });

  test('executes a creator position swap', async () => {
    executeCommand.mockResolvedValue({
      currentVersion: 4,
      events: [],
      previousVersion: 3,
      status: 'saved',
      view: { ...WAITING_VIEW, lastEventSequence: 4 },
    });

    const response = await app.inject({
      body: { commandId: COMMAND_ID, expectedVersion: 3 },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: `/api/games/${GAME_ID}/swap-positions`,
    });

    expect(executeCommand).toHaveBeenCalledWith({
      command: { type: 'SwapPlayerPositions' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
      userId: USER_ID,
    });
    expect(response.statusCode).toBe(200);
  });

  test('closes a waiting lobby for its creator', async () => {
    executeCommand.mockResolvedValue({ status: 'gameDeleted' });

    const response = await app.inject({
      body: { commandId: COMMAND_ID, expectedVersion: 3 },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: `/api/games/${GAME_ID}/leave`,
    });

    expect(executeCommand).toHaveBeenCalledWith({
      command: { type: 'LeaveGame' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
      userId: USER_ID,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ gameId: GAME_ID });
  });

  test('executes surrender for the authenticated player', async () => {
    executeCommand.mockResolvedValue({
      currentVersion: 6,
      events: [],
      previousVersion: 4,
      status: 'saved',
      view: { ...WAITING_VIEW, lastEventSequence: 6, status: 'finished' },
    });

    const response = await app.inject({
      body: { commandId: COMMAND_ID, expectedVersion: 4 },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: `/api/games/${GAME_ID}/surrender`,
    });

    expect(executeCommand).toHaveBeenCalledWith({
      command: { type: 'SurrenderGame' },
      commandId: COMMAND_ID,
      expectedVersion: 4,
      gameId: GAME_ID,
      userId: USER_ID,
    });
    expect(response.statusCode).toBe(200);
  });

  test.each([
    { expectedCode: 'game_command_forbidden', status: 'gameCommandForbidden' },
    { expectedCode: 'game_position_occupied', status: 'gamePositionOccupied' },
    { expectedCode: 'game_version_conflict', status: 'versionConflict' },
    { expectedCode: 'command_id_conflict', status: 'commandIdConflict' },
    { expectedCode: 'game_command_rejected', status: 'commandRejected' },
  ] as const)(
    'maps $status to $expectedCode',
    async ({ expectedCode, status }) => {
      executeCommand.mockResolvedValue(
        status === 'versionConflict'
          ? { currentVersion: 2, status }
          : { status }
      );

      const response = await app.inject({
        body: { commandId: COMMAND_ID, expectedVersion: 1 },
        headers: AUTH_HEADERS,
        method: 'POST',
        url: `/api/games/${GAME_ID}/start`,
      });

      expect(response.json()).toMatchObject({
        error: { code: expectedCode },
      });
    }
  );

  test('maps an existing player game to a conflict response', async () => {
    executeCommand.mockResolvedValue({
      gameId: '20000000-0000-4000-8000-000000000002',
      status: 'playerAlreadyInGame',
    });

    const response = await app.inject({
      body: { commandId: COMMAND_ID, expectedVersion: 1 },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: `/api/games/${GAME_ID}/start`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: { code: 'player_already_in_game' },
    });
  });
});
