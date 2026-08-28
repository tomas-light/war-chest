import type {
  ClientToServerEvents,
  GameErrorMessage,
  GameEventsMessage,
  GameSnapshotMessage,
  LobbyUpdatedMessage,
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
  type GameUpdate,
  createGameService,
} from '../src/games/GameService.js';

vi.mock('../src/games/GameService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createGameService: vi.fn(),
}));

const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '10000000-0000-4000-8000-000000000002';
const GAME_ID = '20000000-0000-4000-8000-000000000001';
const COMMAND_ID = '30000000-0000-4000-8000-000000000001';
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

describe('game Socket.IO adapter', () => {
  let app: FastifyInstance;
  let connect: ReturnType<typeof vi.fn<GameService['connect']>>;
  let clients: GameClientSocket[];
  let closeDatabaseConnection: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn<GameService['disconnect']>>;
  let executeCommand: ReturnType<typeof vi.fn<GameService['executeCommand']>>;
  let gameService: GameService;
  let gameUpdateListener:
    ((update: GameUpdate) => Promise<void> | void) | undefined;
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
        user: { avatarHash: null, displayName: userId, id: userId },
      };

      return Promise.resolve(session);
    });
    connect = vi.fn<GameService['connect']>();
    disconnect = vi.fn<GameService['disconnect']>();
    executeCommand = vi.fn<GameService['executeCommand']>();
    synchronize = vi.fn<GameService['synchronize']>();
    closeDatabaseConnection = vi.fn();
    gameUpdateListener = undefined;
    const subscribe = vi.fn<GameService['subscribe']>((listener) => {
      gameUpdateListener = listener;
      return vi.fn();
    });
    gameService = {
      close: vi.fn(),
      connect,
      createGame: vi.fn(),
      disconnect,
      executeCommand,
      getEvents: vi.fn(),
      getSnapshot: vi.fn(),
      listLobbyGames: vi.fn(),
      recoverActiveGames: vi.fn(),
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

  test('broadcasts a saved command through the service update subscription', async () => {
    connect.mockResolvedValue({
      gameId: GAME_ID,
      status: 'connected',
      view: WAITING_VIEW,
    });
    executeCommand.mockResolvedValue({
      currentVersion: 2,
      events: [],
      previousVersion: 1,
      status: 'saved',
      view: { ...WAITING_VIEW, lastEventSequence: 2 },
    });
    synchronize.mockImplementation(({ userId }) =>
      Promise.resolve({
        currentVersion: 2,
        gameId: GAME_ID,
        status: 'found',
        synchronization: {
          events: [
            {
              payload:
                userId === FIRST_USER_ID
                  ? {
                      moveNumber: 1,
                      nextPlayerId: SECOND_USER_ID,
                      playerId: FIRST_USER_ID,
                      privateData: { card: 'hidden' },
                    }
                  : {
                      moveNumber: 1,
                      nextPlayerId: SECOND_USER_ID,
                      playerId: FIRST_USER_ID,
                    },
              sequence: 2,
              type: 'TestMovePerformed',
              version: 1,
            },
          ],
          type: 'events',
        },
      })
    );
    const firstClient = await connectClient(serverUrl, 'first-session');
    const secondClient = await connectClient(serverUrl, 'second-session');
    clients.push(firstClient, secondClient);
    const firstSnapshot = waitForGameSnapshot(firstClient);
    const secondSnapshot = waitForGameSnapshot(secondClient);
    firstClient.emit('game:join', { gameId: GAME_ID });
    secondClient.emit('game:join', { gameId: GAME_ID });
    await Promise.all([firstSnapshot, secondSnapshot]);
    const firstEvents = waitForGameEvents(firstClient);
    const secondEvents = waitForGameEvents(secondClient);

    firstClient.emit('game:command', {
      command: { privateData: { card: 'hidden' }, type: 'TestMove' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
    });

    await vi.waitFor(() => {
      expect(executeCommand).toHaveBeenCalledOnce();
    });

    if (gameUpdateListener === undefined) {
      throw new Error('Expected a game update subscription.');
    }

    await gameUpdateListener({ gameId: GAME_ID, previousVersion: 1 });

    const [firstMessage, secondMessage] = await Promise.all([
      firstEvents,
      secondEvents,
    ]);
    expect(firstMessage.events[0]).toMatchObject({
      payload: { privateData: { card: 'hidden' } },
    });
    expect(secondMessage.events[0]).not.toHaveProperty('payload.privateData');
    expect(synchronize).toHaveBeenCalledTimes(2);
  });

  test('notifies a subscribed lobby client about a changed game', async () => {
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    await subscribeToLobby(client);
    const lobbyUpdate = waitForLobbyUpdate(client);

    if (gameUpdateListener === undefined) {
      throw new Error('Expected a game update subscription.');
    }

    await gameUpdateListener({ gameId: GAME_ID, previousVersion: 1 });

    await expect(lobbyUpdate).resolves.toEqual({ gameId: GAME_ID });
    expect(synchronize).not.toHaveBeenCalled();
  });

  test('sends saved events directly to a command sender outside the room', async () => {
    executeCommand.mockResolvedValue({
      currentVersion: 2,
      events: [],
      previousVersion: 1,
      status: 'saved',
      view: { ...WAITING_VIEW, lastEventSequence: 2 },
    });
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const events = waitForGameEvents(client);

    client.emit('game:command', {
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
    });

    await expect(events).resolves.toEqual({ events: [], gameId: GAME_ID });
    expect(synchronize).not.toHaveBeenCalled();
  });

  test('synchronizes only the sender for a duplicate command', async () => {
    executeCommand.mockResolvedValue({
      currentVersion: 2,
      status: 'duplicateCommand',
      synchronization: { events: [], type: 'events' },
    });
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const events = waitForGameEvents(client);

    client.emit('game:command', {
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
    });

    await expect(events).resolves.toEqual({ events: [], gameId: GAME_ID });
    expect(synchronize).not.toHaveBeenCalled();
  });

  test('broadcasts system presence updates to the game room', async () => {
    connect.mockResolvedValue({
      gameId: GAME_ID,
      status: 'connected',
      view: WAITING_VIEW,
    });
    synchronize.mockResolvedValue({
      currentVersion: 2,
      gameId: GAME_ID,
      status: 'found',
      synchronization: {
        events: [
          {
            payload: {
              playerId: FIRST_USER_ID,
              reconnectDeadline: '2026-08-16T12:15:00.000Z',
            },
            sequence: 2,
            type: 'PlayerDisconnected',
            version: 1,
          },
        ],
        type: 'events',
      },
    });
    const client = await connectClient(serverUrl, 'second-session');
    clients.push(client);
    const snapshot = waitForGameSnapshot(client);
    client.emit('game:join', { gameId: GAME_ID });
    await snapshot;
    const events = waitForGameEvents(client);

    if (gameUpdateListener === undefined) {
      throw new Error('Expected a game update subscription.');
    }

    await gameUpdateListener({ gameId: GAME_ID, previousVersion: 1 });

    await expect(events).resolves.toMatchObject({
      events: [{ type: 'PlayerDisconnected' }],
      gameId: GAME_ID,
    });
  });

  test('reports the current server version on conflict', async () => {
    executeCommand.mockResolvedValue({
      currentVersion: 4,
      status: 'versionConflict',
    });
    const client = await connectClient(serverUrl, 'first-session');
    clients.push(client);
    const errorMessage = waitForGameError(client);

    client.emit('game:command', {
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
    });

    await expect(errorMessage).resolves.toMatchObject({
      code: 'game_version_conflict',
      currentVersion: 4,
      gameId: GAME_ID,
    });
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

function subscribeToLobby(client: GameClientSocket): Promise<void> {
  return new Promise((resolve) => {
    client.emit('lobby:subscribe', resolve);
  });
}

function waitForLobbyUpdate(
  client: GameClientSocket
): Promise<LobbyUpdatedMessage> {
  return new Promise((resolve) => {
    client.once('lobby:updated', resolve);
  });
}
