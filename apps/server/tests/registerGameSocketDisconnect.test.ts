import type {
  ClientToServerEvents,
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

describe('game Socket.IO disconnects', () => {
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
  test('removes runtime connections on disconnect', async () => {
    connect.mockResolvedValue({
      gameId: GAME_ID,
      status: 'connected',
      view: WAITING_VIEW,
    });
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const snapshot = waitForGameSnapshot(client);
    client.emit('game:join', { gameId: GAME_ID });
    await snapshot;
    const connectionId = client.id;

    client.disconnect();

    await vi.waitFor(() => {
      expect(disconnect).toHaveBeenCalledWith({
        connectionId,
        gameId: GAME_ID,
        userId: FIRST_USER_ID,
      });
    });
  });

  test('waits for persisted disconnects before closing the application', async () => {
    connect.mockResolvedValue({
      gameId: GAME_ID,
      status: 'connected',
      view: WAITING_VIEW,
    });
    let resolveDisconnect:
      | ((result: Awaited<ReturnType<GameService['disconnect']>>) => void)
      | undefined;
    disconnect.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDisconnect = resolve;
        })
    );
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const snapshot = waitForGameSnapshot(client);
    client.emit('game:join', { gameId: GAME_ID });
    await snapshot;
    let applicationClosed = false;

    const closePromise = app.close().then(() => {
      applicationClosed = true;
    });

    await vi.waitFor(() => {
      expect(disconnect).toHaveBeenCalledOnce();
    });
    expect(applicationClosed).toBe(false);
    expect(closeDatabaseConnection).not.toHaveBeenCalled();

    resolveDisconnect?.({ status: 'noChange' });
    await closePromise;

    expect(applicationClosed).toBe(true);
    expect(closeDatabaseConnection).toHaveBeenCalledOnce();
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

function waitForGameSnapshot(
  client: GameClientSocket
): Promise<GameSnapshotMessage> {
  return new Promise((resolve) => {
    client.once('game:snapshot', resolve);
  });
}
