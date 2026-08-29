import {
  type GameResponse,
  createGameRequestSchema,
  gameParamsSchema,
  joinGameRequestSchema,
  leaveGameRequestSchema,
  startGameRequestSchema,
  surrenderGameRequestSchema,
  swapPlayerPositionsRequestSchema,
} from '@war-chest/api-contracts';
import { ApiClientError } from './ApiClientError';
import { createFakeAuthApi } from './createFakeAuthApi';
import { createFakeGameApi } from './createFakeGameApi';
import {
  type FakeAuthProvider,
  type FakeBackendError,
  type FakeBackendEventEnvelope,
  type FakeBackendRequest,
  type FakeBackendResponse,
  isFakeBackendRequest,
} from './FakeBackendProtocol';
import { getFakeDatabase } from './getFakeDatabase';

interface SharedWorkerScope {
  addEventListener(
    type: 'connect',
    listener: (event: MessageEvent<unknown>) => void
  ): void;
}

interface PortState {
  gameSubscriptions: Map<string, Set<string>>;
  lobbySubscriptions: Set<string>;
  port: MessagePort;
  sessionId: string | null;
  userId: string | null;
}

interface ResponseSchema<Result> {
  safeParse(
    value: unknown
  ): { data: Result; success: true } | { success: false };
}

const WORKER_SCOPE = self as unknown as SharedWorkerScope;
const FAKE_AUTH_API = createFakeAuthApi();
const PORT_STATES = new Set<PortState>();
let sequentialOperationPromise: Promise<void> = Promise.resolve();

WORKER_SCOPE.addEventListener('connect', receiveConnection);

function receiveConnection(event: MessageEvent<unknown>): void {
  const [port] = event.ports;

  if (port === undefined) {
    return;
  }

  const state: PortState = {
    gameSubscriptions: new Map(),
    lobbySubscriptions: new Set(),
    port,
    sessionId: null,
    userId: null,
  };

  PORT_STATES.add(state);
  port.addEventListener('message', (messageEvent) => {
    receiveRequest(state, messageEvent);
  });
  port.start();
}

function receiveRequest(state: PortState, event: MessageEvent<unknown>): void {
  if (!isFakeBackendRequest(event.data)) {
    return;
  }

  const request = event.data;

  void runSequentially(() => dispatchRequest(state, request)).then(
    (result) => {
      sendResponse(state, {
        requestId: request.requestId,
        result,
        success: true,
        type: 'response',
      });
    },
    (error: unknown) => {
      sendResponse(state, {
        error: serializeError(error),
        requestId: request.requestId,
        success: false,
        type: 'response',
      });
    }
  );
}

function runSequentially<Result>(
  operation: () => Result | Promise<Result>
): Promise<Result> {
  const operationPromise = sequentialOperationPromise.then(operation);

  sequentialOperationPromise = operationPromise.then(
    () => undefined,
    () => undefined // allow the queue to continue after a failed operation
  );

  return operationPromise;
}

async function dispatchRequest(
  state: PortState,
  request: FakeBackendRequest
): Promise<unknown> {
  if (request.operation === 'auth.getSession') {
    const sessionId = readNullableStringProperty(request.payload, 'sessionId');
    const session = await FAKE_AUTH_API.getSession(sessionId);

    bindSession(state, sessionId, session?.user.id ?? null);
    return session;
  }

  if (request.operation === 'auth.login') {
    const provider = readAuthProvider(request.payload);
    const result = await FAKE_AUTH_API.login(provider);

    bindSession(state, result.sessionId, result.session.user.id);
    return result;
  }

  if (request.operation === 'auth.logout') {
    const sessionId = readNullableStringProperty(request.payload, 'sessionId');

    await FAKE_AUTH_API.logout(sessionId);
    bindSession(state, null, null);
    return null;
  }

  if (request.operation === 'featureFlags.read') {
    requireNullPayload(request.payload);
    const database = await getFakeDatabase();

    return database.featureFlags.getApplication();
  }

  if (request.operation === 'lobby.subscribe') {
    state.lobbySubscriptions.add(
      readStringProperty(request.payload, 'subscriptionId')
    );
    return null;
  }

  if (request.operation === 'lobby.unsubscribe') {
    state.lobbySubscriptions.delete(
      readStringProperty(request.payload, 'subscriptionId')
    );
    return null;
  }

  if (request.operation === 'gameConnection.disconnect') {
    state.gameSubscriptions.delete(
      readStringProperty(request.payload, 'subscriptionId')
    );
    return null;
  }

  if (request.operation === 'gameConnection.leave') {
    const gameId = readGameId(request.payload);
    const subscriptionId = readStringProperty(
      request.payload,
      'subscriptionId'
    );
    const gameIds = state.gameSubscriptions.get(subscriptionId);

    gameIds?.delete(gameId);

    if (gameIds?.size === 0) {
      state.gameSubscriptions.delete(subscriptionId);
    }

    return null;
  }

  if (request.operation === 'gameConnection.join') {
    const gameId = readGameId(request.payload);
    const subscriptionId = readStringProperty(
      request.payload,
      'subscriptionId'
    );
    const game = await getAuthenticatedGame(state, gameId);
    const gameIds = state.gameSubscriptions.get(subscriptionId) ?? new Set();

    gameIds.add(gameId);
    state.gameSubscriptions.set(subscriptionId, gameIds);
    return game;
  }

  if (request.operation === 'gameConnection.synchronize') {
    const gameId = readGameId(request.payload);
    const subscriptionId = readStringProperty(
      request.payload,
      'subscriptionId'
    );
    const afterSequence = readNonNegativeIntegerProperty(
      request.payload,
      'afterSequence'
    );
    const gameIds = state.gameSubscriptions.get(subscriptionId);

    if (gameIds === undefined || !gameIds.has(gameId)) {
      throw new ApiClientError({
        code: 'invalid_message',
        diagnosticMessage: 'The fake game connection is not subscribed.',
      });
    }

    // Fake synchronization currently returns a full snapshot. Reading the
    // sequence still validates the same client contract as Socket.IO.
    void afterSequence;
    return getAuthenticatedGame(state, gameId);
  }

  const userId = await requireAuthenticatedUserId(state);
  const gameApi = createFakeGameApi(userId);

  if (request.operation === 'game.create') {
    const result = await gameApi.createGame(
      parsePayload(createGameRequestSchema, request.payload)
    );

    await broadcastGameUpdate(result.gameId);
    return result;
  }

  if (request.operation === 'game.get') {
    return gameApi.getGame(readGameId(request.payload));
  }

  if (request.operation === 'game.listLobby') {
    requireNullPayload(request.payload);
    return gameApi.listLobbyGames();
  }

  if (request.operation === 'game.join') {
    const gameId = readGameId(request.payload);
    const result = await gameApi.joinGame(
      gameId,
      readNestedRequest(
        request.payload,
        joinGameRequestSchema,
        'Invalid fake JoinGame request.'
      )
    );

    await broadcastGameUpdate(gameId);
    return result;
  }

  if (request.operation === 'game.leave') {
    const gameId = readGameId(request.payload);
    const result = await gameApi.leaveGame(
      gameId,
      readNestedRequest(
        request.payload,
        leaveGameRequestSchema,
        'Invalid fake LeaveGame request.'
      )
    );

    await broadcastGameUpdate(gameId);
    return result;
  }

  if (request.operation === 'game.start') {
    const gameId = readGameId(request.payload);
    const result = await gameApi.startGame(
      gameId,
      readNestedRequest(
        request.payload,
        startGameRequestSchema,
        'Invalid fake StartGame request.'
      )
    );

    await broadcastGameUpdate(gameId);
    return result;
  }

  if (request.operation === 'game.surrender') {
    const gameId = readGameId(request.payload);
    const result = await gameApi.surrenderGame(
      gameId,
      readNestedRequest(
        request.payload,
        surrenderGameRequestSchema,
        'Invalid fake SurrenderGame request.'
      )
    );

    await broadcastGameUpdate(gameId);
    return result;
  }

  if (request.operation === 'game.swapPositions') {
    const gameId = readGameId(request.payload);
    const result = await gameApi.swapPlayerPositions(
      gameId,
      readNestedRequest(
        request.payload,
        swapPlayerPositionsRequestSchema,
        'Invalid fake SwapPlayerPositions request.'
      )
    );

    await broadcastGameUpdate(gameId);
    return result;
  }

  throw createInvalidMessageError('Unknown fake backend operation.');
}

function bindSession(
  state: PortState,
  sessionId: string | null,
  userId: string | null
): void {
  if (state.userId !== userId) {
    state.gameSubscriptions.clear();
  }

  state.sessionId = userId === null ? null : sessionId;
  state.userId = userId;
}

async function requireAuthenticatedUserId(state: PortState): Promise<string> {
  const session = await FAKE_AUTH_API.getSession(state.sessionId);

  if (session === null) {
    bindSession(state, null, null);
    throw new ApiClientError({
      code: 'unauthorized',
      diagnosticMessage: 'Authentication is required.',
    });
  }

  bindSession(state, state.sessionId, session.user.id);
  return session.user.id;
}

async function getAuthenticatedGame(
  state: PortState,
  gameId: string
): Promise<GameResponse> {
  const userId = await requireAuthenticatedUserId(state);
  return createFakeGameApi(userId).getGame(gameId);
}

async function broadcastGameUpdate(gameId: string): Promise<void> {
  for (const state of PORT_STATES) {
    for (const subscriptionId of state.lobbySubscriptions) {
      sendEvent(state, {
        event: 'lobby.updated',
        payload: { gameId },
        subscriptionId,
        type: 'event',
      });
    }

    const matchingSubscriptionIds = [...state.gameSubscriptions]
      .filter(([, gameIds]) => gameIds.has(gameId))
      .map(([subscriptionId]) => subscriptionId);

    if (matchingSubscriptionIds.length === 0) {
      continue;
    }

    try {
      const game = await getAuthenticatedGame(state, gameId);

      for (const subscriptionId of matchingSubscriptionIds) {
        sendEvent(state, {
          event: 'game.snapshot',
          payload: game,
          subscriptionId,
          type: 'event',
        });
      }
    } catch (error) {
      const serializedError = serializeError(error);

      for (const subscriptionId of matchingSubscriptionIds) {
        sendEvent(state, {
          event: 'game.error',
          payload: {
            code: serializedError.code,
            gameId,
            message: serializedError.message,
          },
          subscriptionId,
          type: 'event',
        });
      }

      if (error instanceof ApiClientError && error.code === 'game_not_found') {
        for (const gameIds of state.gameSubscriptions.values()) {
          gameIds.delete(gameId);
        }
      }
    }
  }
}

function readAuthProvider(payload: unknown): FakeAuthProvider {
  const provider = readStringProperty(payload, 'provider');

  if (
    provider !== 'google' &&
    provider !== 'telegram' &&
    provider !== 'yandex'
  ) {
    throw createInvalidMessageError('Invalid fake auth provider.');
  }

  return provider;
}

function readGameId(payload: unknown): string {
  return parsePayload(gameParamsSchema, {
    gameId: readStringProperty(payload, 'gameId'),
  }).gameId;
}

function readNestedRequest<Result>(
  payload: unknown,
  schema: ResponseSchema<Result>,
  diagnosticMessage: string
): Result {
  const input = requireRecord(payload);
  const result = schema.safeParse(input.request);

  if (!result.success) {
    throw createInvalidMessageError(diagnosticMessage);
  }

  return result.data;
}

function parsePayload<Result>(
  schema: ResponseSchema<Result>,
  payload: unknown
): Result {
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw createInvalidMessageError('Invalid fake backend request payload.');
  }

  return result.data;
}

function readStringProperty(payload: unknown, property: string): string {
  const value = requireRecord(payload)[property];

  if (typeof value !== 'string' || value === '') {
    throw createInvalidMessageError(
      `Fake backend property ${property} must be a non-empty string.`
    );
  }

  return value;
}

function readNullableStringProperty(
  payload: unknown,
  property: string
): string | null {
  const value = requireRecord(payload)[property];

  if (value !== null && typeof value !== 'string') {
    throw createInvalidMessageError(
      `Fake backend property ${property} must be a string or null.`
    );
  }

  return value;
}

function readNonNegativeIntegerProperty(
  payload: unknown,
  property: string
): number {
  const value = requireRecord(payload)[property];

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw createInvalidMessageError(
      `Fake backend property ${property} must be a non-negative safe integer.`
    );
  }

  return value;
}

function requireRecord(payload: unknown): Record<string, unknown> {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw createInvalidMessageError(
      'The fake backend request payload must be an object.'
    );
  }

  return payload as Record<string, unknown>;
}

function requireNullPayload(payload: unknown): void {
  if (payload !== null) {
    throw createInvalidMessageError(
      'The fake backend request does not accept a payload.'
    );
  }
}

function createInvalidMessageError(diagnosticMessage: string): ApiClientError {
  return new ApiClientError({ code: 'invalid_message', diagnosticMessage });
}

function serializeError(error: unknown): FakeBackendError {
  if (error instanceof ApiClientError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: 'internal_error',
    message:
      error instanceof Error
        ? error.message
        : 'The fake backend operation failed unexpectedly.',
  };
}

function sendResponse(state: PortState, response: FakeBackendResponse): void {
  try {
    state.port.postMessage(response);
  } catch {
    PORT_STATES.delete(state);
  }
}

function sendEvent(state: PortState, event: FakeBackendEventEnvelope): void {
  try {
    state.port.postMessage(event);
  } catch {
    PORT_STATES.delete(state);
  }
}
