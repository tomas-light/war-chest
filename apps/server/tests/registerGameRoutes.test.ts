import type { Auth, AuthSession } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
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
  currentPlayerId: null,
  featureFlags: { spectatorMode: true },
  lastEventSequence: 1,
  moveCount: 0,
  players: [],
  privateMoves: [],
  rulesVersion: 1,
  status: 'waiting',
  teams: { black: [], white: [] },
  winnerTeam: null,
};

describe('game HTTP routes', () => {
  let app: FastifyInstance;
  let createGame: ReturnType<typeof vi.fn<GameService['createGame']>>;
  let executeCommand: ReturnType<typeof vi.fn<GameService['executeCommand']>>;
  let getEvents: ReturnType<typeof vi.fn<GameService['getEvents']>>;
  let getSession: ReturnType<typeof vi.fn<Auth['getSession']>>;
  let getSnapshot: ReturnType<typeof vi.fn<GameService['getSnapshot']>>;

  beforeEach(() => {
    const session: AuthSession = {
      expiresAt: new Date('2026-09-03T10:00:00.000Z'),
      user: {
        avatarHash: null,
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
    const gameService: GameService = {
      close: vi.fn(),
      connect: vi.fn(),
      createGame,
      disconnect: vi.fn(),
      executeCommand,
      getEvents,
      getSnapshot,
      recoverActiveGames: vi.fn(),
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
      featureFlagsService: { read: vi.fn() },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test.each([
    { method: 'POST', url: '/api/games' },
    { method: 'GET', url: `/api/games/${GAME_ID}` },
    { method: 'POST', url: `/api/games/${GAME_ID}/join` },
    { method: 'POST', url: `/api/games/${GAME_ID}/start` },
    { method: 'GET', url: `/api/games/${GAME_ID}/events` },
  ])('requires authentication for $method $url', async ({ method, url }) => {
    getSession.mockResolvedValue(null);

    const response = await app.inject({ method, url });

    expect(response.statusCode).toBe(401);
  });

  test('creates a game for the authenticated user', async () => {
    createGame.mockResolvedValue({
      gameId: GAME_ID,
      status: 'created',
      view: WAITING_VIEW,
    });

    const response = await app.inject({
      body: { commandId: COMMAND_ID },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: '/api/games',
    });

    expect(createGame).toHaveBeenCalledWith({
      commandId: COMMAND_ID,
      userId: USER_ID,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ gameId: GAME_ID, view: WAITING_VIEW });
  });

  test('returns 200 for a duplicate create command', async () => {
    createGame.mockResolvedValue({
      gameId: GAME_ID,
      status: 'duplicateCommand',
      view: WAITING_VIEW,
    });

    const response = await app.inject({
      body: { commandId: COMMAND_ID },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: '/api/games',
    });

    expect(response.statusCode).toBe(200);
  });

  test('rejects an invalid create body before the service', async () => {
    const response = await app.inject({
      body: { commandId: 'not-a-uuid', userId: USER_ID },
      headers: AUTH_HEADERS,
      method: 'POST',
      url: '/api/games',
    });

    expect(response.statusCode).toBe(400);
    expect(createGame).not.toHaveBeenCalled();
  });

  test('returns a safe game snapshot', async () => {
    getSnapshot.mockResolvedValue({
      gameId: GAME_ID,
      status: 'found',
      view: WAITING_VIEW,
    });

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/games/${GAME_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ gameId: GAME_ID, view: WAITING_VIEW });
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

  test('returns safe events after the requested sequence', async () => {
    getEvents.mockResolvedValue({
      events: [],
      gameId: GAME_ID,
      status: 'found',
    });

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/games/${GAME_ID}/events?afterSequence=2`,
    });

    expect(getEvents).toHaveBeenCalledWith({
      afterSequence: 2,
      gameId: GAME_ID,
      userId: USER_ID,
    });
    expect(response.json()).toEqual({ events: [], gameId: GAME_ID });
  });
});
