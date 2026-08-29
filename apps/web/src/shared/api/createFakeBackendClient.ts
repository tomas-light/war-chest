import {
  type CreateGameRequest,
  type GameErrorMessage,
  type GameResponse,
  type GameSnapshotMessage,
  type JoinGameRequest,
  type LeaveGameRequest,
  type LeaveGameResponse,
  type LobbyGamesResponse,
  type LobbyUpdatedMessage,
  type SessionResponse,
  type StartGameRequest,
  type SurrenderGameRequest,
  type SwapPlayerPositionsRequest,
  gameErrorMessageSchema,
  gameResponseSchema,
  gameSnapshotMessageSchema,
  leaveGameResponseSchema,
  lobbyGamesResponseSchema,
  lobbyUpdatedMessageSchema,
  sessionResponseSchema,
} from '@war-chest/api-contracts';
import {
  type RuntimeFeatureFlags,
  runtimeFeatureFlagsSchema,
} from '@war-chest/feature-flags';
import { ApiClientError, createApiClientError } from './ApiClientError';
import {
  type FakeAuthProvider,
  type FakeBackendEventEnvelope,
  type FakeBackendOperation,
  type FakeBackendRequest,
  type FakeBackendWorkerMessage,
  type FakeLoginResult,
  isFakeBackendWorkerMessage,
} from './FakeBackendProtocol';

interface ResponseSchema<Result> {
  safeParse(
    value: unknown
  ): { data: Result; success: true } | { success: false };
}

interface PendingRequest {
  reject(reason: unknown): void;
  resolve(value: unknown): void;
}

export type FakeBackendEvent =
  | {
      message: GameErrorMessage;
      name: 'game.error';
      subscriptionId: string;
    }
  | {
      message: GameSnapshotMessage;
      name: 'game.snapshot';
      subscriptionId: string;
    }
  | {
      message: LobbyUpdatedMessage;
      name: 'lobby.updated';
      subscriptionId: string;
    };

export interface FakeBackendClient {
  createGame(this: void, request: CreateGameRequest): Promise<GameResponse>;
  disconnectGameConnection(this: void, subscriptionId: string): Promise<void>;
  getGame(this: void, gameId: string): Promise<GameResponse>;
  getSession(
    this: void,
    sessionId: string | null
  ): Promise<SessionResponse | null>;
  joinGame(
    this: void,
    gameId: string,
    request: JoinGameRequest
  ): Promise<GameResponse>;
  joinGameConnection(
    this: void,
    gameId: string,
    subscriptionId: string
  ): Promise<GameResponse>;
  leaveGame(
    this: void,
    gameId: string,
    request: LeaveGameRequest
  ): Promise<LeaveGameResponse>;
  leaveGameConnection(
    this: void,
    gameId: string,
    subscriptionId: string
  ): Promise<void>;
  listLobbyGames(this: void): Promise<LobbyGamesResponse>;
  login(this: void, provider: FakeAuthProvider): Promise<FakeLoginResult>;
  logout(this: void, sessionId: string | null): Promise<void>;
  readFeatureFlags(this: void): Promise<RuntimeFeatureFlags>;
  startGame(
    this: void,
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse>;
  subscribe(
    this: void,
    listener: (event: FakeBackendEvent) => void
  ): () => void;
  subscribeToLobby(this: void, subscriptionId: string): Promise<void>;
  surrenderGame(
    this: void,
    gameId: string,
    request: SurrenderGameRequest
  ): Promise<GameResponse>;
  swapPlayerPositions(
    this: void,
    gameId: string,
    request: SwapPlayerPositionsRequest
  ): Promise<GameResponse>;
  synchronizeGameConnection(
    this: void,
    afterSequence: number,
    gameId: string,
    subscriptionId: string
  ): Promise<GameResponse>;
  unsubscribeFromLobby(this: void, subscriptionId: string): Promise<void>;
}

export function createFakeBackendClient(): FakeBackendClient {
  const worker = new SharedWorker(
    new URL('./fakeBackendSharedWorker.ts', import.meta.url),
    { name: 'war-chest-fake-backend', type: 'module' }
  );
  const eventListeners = new Set<(event: FakeBackendEvent) => void>();
  const pendingRequests = new Map<number, PendingRequest>();
  let nextRequestId = 1;
  let terminalError: ApiClientError | null = null;

  worker.addEventListener('error', handleWorkerError);
  worker.port.addEventListener('message', receiveMessage);
  worker.port.addEventListener('messageerror', handleMessageError);
  worker.port.start();

  return {
    createGame,
    disconnectGameConnection,
    getGame,
    getSession,
    joinGame,
    joinGameConnection,
    leaveGame,
    leaveGameConnection,
    listLobbyGames,
    login,
    logout,
    readFeatureFlags,
    startGame,
    subscribe,
    subscribeToLobby,
    surrenderGame,
    swapPlayerPositions,
    synchronizeGameConnection,
    unsubscribeFromLobby,
  };

  function createGame(request: CreateGameRequest): Promise<GameResponse> {
    return sendRequest(
      'game.create',
      request,
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid created game.'
      )
    );
  }

  function disconnectGameConnection(subscriptionId: string): Promise<void> {
    return sendRequest(
      'gameConnection.disconnect',
      { subscriptionId },
      parseVoidResult
    );
  }

  function getGame(gameId: string): Promise<GameResponse> {
    return sendRequest(
      'game.get',
      { gameId },
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid game state.'
      )
    );
  }

  function getSession(
    sessionId: string | null
  ): Promise<SessionResponse | null> {
    return sendRequest('auth.getSession', { sessionId }, parseNullableSession);
  }

  function joinGame(
    gameId: string,
    request: JoinGameRequest
  ): Promise<GameResponse> {
    return sendRequest(
      'game.join',
      { gameId, request },
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid game state.'
      )
    );
  }

  function joinGameConnection(
    gameId: string,
    subscriptionId: string
  ): Promise<GameResponse> {
    return sendRequest(
      'gameConnection.join',
      { gameId, subscriptionId },
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid game snapshot.'
      )
    );
  }

  function leaveGame(
    gameId: string,
    request: LeaveGameRequest
  ): Promise<LeaveGameResponse> {
    return sendRequest(
      'game.leave',
      { gameId, request },
      createSchemaParser(
        leaveGameResponseSchema,
        'The fake backend returned an invalid leave result.'
      )
    );
  }

  function leaveGameConnection(
    gameId: string,
    subscriptionId: string
  ): Promise<void> {
    return sendRequest(
      'gameConnection.leave',
      { gameId, subscriptionId },
      parseVoidResult
    );
  }

  function listLobbyGames(): Promise<LobbyGamesResponse> {
    return sendRequest(
      'game.listLobby',
      null,
      createSchemaParser(
        lobbyGamesResponseSchema,
        'The fake backend returned an invalid game list.'
      )
    );
  }

  function login(provider: FakeAuthProvider): Promise<FakeLoginResult> {
    return sendRequest('auth.login', { provider }, parseLoginResult);
  }

  function logout(sessionId: string | null): Promise<void> {
    return sendRequest('auth.logout', { sessionId }, parseVoidResult);
  }

  function readFeatureFlags(): Promise<RuntimeFeatureFlags> {
    return sendRequest(
      'featureFlags.read',
      null,
      createSchemaParser(
        runtimeFeatureFlagsSchema,
        'The fake backend returned invalid feature flags.'
      )
    );
  }

  function startGame(
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse> {
    return sendRequest(
      'game.start',
      { gameId, request },
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid game state.'
      )
    );
  }

  function subscribe(listener: (event: FakeBackendEvent) => void): () => void {
    eventListeners.add(listener);
    return unsubscribe;

    function unsubscribe(): void {
      eventListeners.delete(listener);
    }
  }

  function subscribeToLobby(subscriptionId: string): Promise<void> {
    return sendRequest('lobby.subscribe', { subscriptionId }, parseVoidResult);
  }

  function surrenderGame(
    gameId: string,
    request: SurrenderGameRequest
  ): Promise<GameResponse> {
    return sendRequest(
      'game.surrender',
      { gameId, request },
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid game state.'
      )
    );
  }

  function swapPlayerPositions(
    gameId: string,
    request: SwapPlayerPositionsRequest
  ): Promise<GameResponse> {
    return sendRequest(
      'game.swapPositions',
      { gameId, request },
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid game state.'
      )
    );
  }

  function synchronizeGameConnection(
    afterSequence: number,
    gameId: string,
    subscriptionId: string
  ): Promise<GameResponse> {
    return sendRequest(
      'gameConnection.synchronize',
      { afterSequence, gameId, subscriptionId },
      createSchemaParser(
        gameResponseSchema,
        'The fake backend returned an invalid synchronized game.'
      )
    );
  }

  function unsubscribeFromLobby(subscriptionId: string): Promise<void> {
    return sendRequest(
      'lobby.unsubscribe',
      { subscriptionId },
      parseVoidResult
    );
  }

  function sendRequest<Result>(
    operation: FakeBackendOperation,
    payload: unknown,
    parseResult: (value: unknown) => Result
  ): Promise<Result> {
    if (terminalError !== null) {
      return Promise.reject(terminalError);
    }

    const requestId = nextRequestId;
    nextRequestId += 1;

    return new Promise<Result>((resolve, reject) => {
      const request: FakeBackendRequest = {
        operation,
        payload,
        requestId,
        type: 'request',
      };
      const pendingRequest: PendingRequest = {
        reject,
        resolve(value) {
          try {
            resolve(parseResult(value));
          } catch (error) {
            reject(normalizeError(error));
          }
        },
      };

      pendingRequests.set(requestId, pendingRequest);

      try {
        worker.port.postMessage(request);
      } catch (error) {
        pendingRequests.delete(requestId);
        reject(normalizeError(error));
      }
    });
  }

  function receiveMessage(event: MessageEvent<unknown>): void {
    if (!isFakeBackendWorkerMessage(event.data)) {
      failPendingRequests(createInvalidWorkerResponseError());
      return;
    }

    handleWorkerMessage(event.data);
  }

  function handleWorkerMessage(message: FakeBackendWorkerMessage): void {
    if (message.type === 'event') {
      let event: FakeBackendEvent;

      try {
        event = parseWorkerEvent(message);
      } catch (error) {
        failPendingRequests(createInvalidWorkerResponseError(error));
        return;
      }

      for (const listener of eventListeners) {
        listener(event);
      }

      return;
    }

    const pendingRequest = pendingRequests.get(message.requestId);

    if (pendingRequest === undefined) {
      return;
    }

    pendingRequests.delete(message.requestId);

    if (message.success) {
      pendingRequest.resolve(message.result);
      return;
    }

    pendingRequest.reject(
      createApiClientError({
        code: message.error.code,
        diagnosticMessage: message.error.message,
      })
    );
  }

  function handleWorkerError(event: ErrorEvent): void {
    failPendingRequests(
      new ApiClientError({
        cause: event.error,
        code: 'internal_error',
        diagnosticMessage: 'The fake backend worker stopped unexpectedly.',
      })
    );
  }

  function handleMessageError(event: MessageEvent<unknown>): void {
    failPendingRequests(
      new ApiClientError({
        cause: event.data,
        code: 'invalid_response',
        diagnosticMessage: 'The fake backend returned an unreadable message.',
      })
    );
  }

  function failPendingRequests(error: ApiClientError): void {
    terminalError = error;

    for (const pendingRequest of pendingRequests.values()) {
      pendingRequest.reject(error);
    }

    pendingRequests.clear();
  }
}

function createSchemaParser<Result>(
  schema: ResponseSchema<Result>,
  diagnosticMessage: string
): (value: unknown) => Result {
  return parseResult;

  function parseResult(value: unknown): Result {
    const result = schema.safeParse(value);

    if (!result.success) {
      throw new ApiClientError({
        code: 'invalid_response',
        diagnosticMessage,
      });
    }

    return result.data;
  }
}

function parseNullableSession(value: unknown): SessionResponse | null {
  if (value === null) {
    return null;
  }

  return createSchemaParser(
    sessionResponseSchema,
    'The fake backend returned an invalid session.'
  )(value);
}

function parseLoginResult(value: unknown): FakeLoginResult {
  if (!isRecord(value) || typeof value.sessionId !== 'string') {
    throw new ApiClientError({
      code: 'invalid_response',
      diagnosticMessage: 'The fake backend returned an invalid login result.',
    });
  }

  return {
    session: createSchemaParser(
      sessionResponseSchema,
      'The fake backend returned an invalid login session.'
    )(value.session),
    sessionId: value.sessionId,
  };
}

function parseVoidResult(value: unknown): void {
  if (value !== null) {
    throw new ApiClientError({
      code: 'invalid_response',
      diagnosticMessage: 'The fake backend returned an unexpected result.',
    });
  }
}

function parseWorkerEvent(
  envelope: FakeBackendEventEnvelope
): FakeBackendEvent {
  if (envelope.event === 'game.error') {
    return {
      message: createSchemaParser(
        gameErrorMessageSchema,
        'The fake backend returned an invalid game error.'
      )(envelope.payload),
      name: envelope.event,
      subscriptionId: envelope.subscriptionId,
    };
  }

  if (envelope.event === 'game.snapshot') {
    return {
      message: createSchemaParser(
        gameSnapshotMessageSchema,
        'The fake backend returned an invalid game snapshot.'
      )(envelope.payload),
      name: envelope.event,
      subscriptionId: envelope.subscriptionId,
    };
  }

  return {
    message: createSchemaParser(
      lobbyUpdatedMessageSchema,
      'The fake backend returned an invalid lobby update.'
    )(envelope.payload),
    name: envelope.event,
    subscriptionId: envelope.subscriptionId,
  };
}

function createInvalidWorkerResponseError(cause?: unknown): ApiClientError {
  return new ApiClientError({
    cause,
    code: 'invalid_response',
    diagnosticMessage: 'The fake backend returned an invalid worker message.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('The fake backend client failed unexpectedly.', {
        cause: error,
      });
}
