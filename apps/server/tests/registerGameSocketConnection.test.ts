import type {
  ClientToServerEvents,
  GameErrorMessage,
  GameEventsMessage,
  GameSnapshotMessage,
  ServerToClientEvents,
} from '@war-chest/api-contracts';
import type { Auth, AuthSession } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import type { GameView } from '@war-chest/game-engine';
import type { FastifyInstance } from 'fastify';
import { type Socket as ClientSocket, io } from 'socket.io-client';
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

const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '10000000-0000-4000-8000-000000000002';
const GAME_ID = '20000000-0000-4000-8000-000000000001';
const WAITING_VIEW: GameView = {
  creatorId: FIRST_USER_ID,
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

type GameClientSocket = ClientSocket<
  ServerToClientEvents,
  ClientToServerEvents
>;

describe('game Socket.IO connection adapter', () => {
  let app: FastifyInstance;
  let connect: ReturnType<typeof vi.fn<GameService['connect']>>;
  let clients: GameClientSocket[];
  let closeDatabaseConnection: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn<GameService['disconnect']>>;
  let executeCommand: ReturnType<typeof vi.fn<GameService['executeCommand']>>;
  let gameService: GameService;
  let serverUrl: string;
  let synchronize: ReturnType<typeof vi.fn<GameService['synchronize']>>;

  beforeEach(async () => {
    const getSession = vi.fn<Auth['getSession']>();
    getSession.mockImplementation((sessionToken) => {
      const userId =
        sessionToken === 'first-session'
          ? FIRST_USER_ID
          : sessionToken === 'second-session'
            ? SECOND_USER_ID
            : null;

      if (userId === null) {
        return Promise.resolve(null);
      }

      const session: AuthSession = {
        expiresAt: new Date('2026-09-03T10:00:00.000Z'),
        user: { avatarVersion: null, displayName: userId, id: userId },
      };

      return Promise.resolve(session);
    });
    connect = vi.fn<GameService['connect']>();
    disconnect = vi.fn<GameService['disconnect']>();
    executeCommand = vi.fn<GameService['executeCommand']>();
    synchronize = vi.fn<GameService['synchronize']>();
    closeDatabaseConnection = vi.fn();
    const subscribe = vi.fn<GameService['subscribe']>(() => vi.fn());
    gameService = {
      close: vi.fn(),
      connect,
      createGame: vi.fn(),
      disconnect,
      executeCommand,
      getEvents: vi.fn(),
      getSnapshot: vi.fn(),
      listLobbyGames: vi.fn(),
      recoverGames: vi.fn(),
      subscribe,
      synchronize,
    };
    const auth = {
      getSession,
      sessionCookieName: 'war_chest_session',
    } as unknown as Auth;
    const databaseConnection = {
      checkConnection: vi.fn(),
      close: closeDatabaseConnection,
    } as unknown as DatabaseConnection;
    vi.mocked(createGameService).mockReturnValue(gameService);

    app = createApp({
      auth,
      databaseConnection,
      disconnectedPlayerTimeoutMinutes: 15,
      emptyWaitingGameTimeoutMinutes: 10,
      featureFlagsService: { read: vi.fn() },
    });
    serverUrl = await app.listen({ host: '127.0.0.1', port: 0 });
    clients = [];
  });

  afterEach(async () => {
    for (const client of clients) {
      client.close();
    }

    await app.close();
  });
  test('rejects an unauthenticated handshake', async () => {
    const client = io(serverUrl, {
      autoConnect: false,
      path: '/api/socket.io',
      reconnection: false,
    });
    clients.push(client);

    const error = await connectExpectingError(client);

    expect(error.message).toBe('Authentication is required.');
  });

  test('rejects a malformed command before the service', async () => {
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const errorMessage = waitForGameError(client);

    const unsafeClient = client as unknown as {
      emit(eventName: 'game:command', message: unknown): void;
    };
    unsafeClient.emit('game:command', { gameId: 'invalid' });

    await expect(errorMessage).resolves.toMatchObject({
      code: 'invalid_message',
      gameId: null,
    });
    expect(executeCommand).not.toHaveBeenCalled();
  });

  test('joins a room and sends the personalized snapshot', async () => {
    connect.mockResolvedValue({
      gameId: GAME_ID,
      status: 'connected',
      view: WAITING_VIEW,
    });
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const snapshot = waitForGameSnapshot(client);

    client.emit('game:join', { gameId: GAME_ID });

    await expect(snapshot).resolves.toEqual({
      gameId: GAME_ID,
      view: WAITING_VIEW,
    });
    expect(connect).toHaveBeenCalledWith({
      connectionId: client.id,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
  });

  test('sends a requested synchronization tail', async () => {
    synchronize.mockResolvedValue({
      currentVersion: 1,
      gameId: GAME_ID,
      status: 'found',
      synchronization: { events: [], type: 'events' },
    });
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const events = waitForGameEvents(client);

    client.emit('game:sync', { afterSequence: 1, gameId: GAME_ID });

    await expect(events).resolves.toEqual({ events: [], gameId: GAME_ID });
    expect(synchronize).toHaveBeenCalledWith({
      afterSequence: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
  });
});

function connectClient(
  serverUrl: string,
  sessionToken: string
): Promise<GameClientSocket> {
  const client: GameClientSocket = io(serverUrl, {
    autoConnect: false,
    extraHeaders: {
      cookie: `war_chest_session=${sessionToken}`,
    },
    path: '/api/socket.io',
    reconnection: false,
  });

  return new Promise((resolve, reject) => {
    client.once('connect', handleConnect);
    client.once('connect_error', handleConnectionError);
    client.connect();

    function handleConnect(): void {
      client.off('connect_error', handleConnectionError);
      resolve(client);
    }

    function handleConnectionError(error: Error): void {
      client.off('connect', handleConnect);
      reject(error);
    }
  });
}

function connectExpectingError(client: GameClientSocket): Promise<Error> {
  return new Promise((resolve) => {
    client.once('connect_error', resolve);
    client.connect();
  });
}

function waitForGameError(client: GameClientSocket): Promise<GameErrorMessage> {
  return new Promise((resolve) => {
    client.once('game:error', resolve);
  });
}

function waitForGameEvents(
  client: GameClientSocket
): Promise<GameEventsMessage> {
  return new Promise((resolve) => {
    client.once('game:events', resolve);
  });
}

function waitForGameSnapshot(
  client: GameClientSocket
): Promise<GameSnapshotMessage> {
  return new Promise((resolve) => {
    client.once('game:snapshot', resolve);
  });
}
