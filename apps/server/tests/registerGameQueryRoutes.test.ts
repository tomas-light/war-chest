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

describe('game query HTTP routes', () => {
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

  test('returns a safe game snapshot', async () => {
    getSnapshot.mockResolvedValue({
      gameId: GAME_ID,
      players: [
        {
          avatarVersion: null,
          displayName: 'Ada',
          id: USER_ID,
          seat: 1,
          team: 'white',
        },
      ],
      status: 'found',
      view: WAITING_VIEW,
    });

    const response = await app.inject({
      headers: AUTH_HEADERS,
      method: 'GET',
      url: `/api/games/${GAME_ID}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      gameId: GAME_ID,
      players: [
        {
          avatarVersion: null,
          displayName: 'Ada',
          id: USER_ID,
          seat: 1,
          team: 'white',
        },
      ],
      view: WAITING_VIEW,
    });
  });
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
