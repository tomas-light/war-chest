import {
  type CancelTurnDraftRequest,
  type CompleteCardSelectionRequest,
  type ConfirmCardChoiceRequest,
  type ConfirmTurnDraftRequest,
  type CreateGameRequest,
  type GameResponse,
  type GameTurnDraftResponse,
  type GameTurnHistoryQuery,
  type GameTurnHistoryResponse,
  type JoinGameRequest,
  type LeaveGameRequest,
  type LeaveGameResponse,
  type LobbyGamesResponse,
  type PassTurnRequest,
  type SaveTurnDraftRequest,
  type StartGameRequest,
  type SurrenderGameRequest,
  type SwapPlayerPositionsRequest,
  type UpdateGameSettingsRequest,
  gameResponseSchema,
  gameTurnDraftResponseSchema,
  gameTurnHistoryResponseSchema,
  leaveGameResponseSchema,
  lobbyGamesResponseSchema,
} from '@war-chest/api-contracts';
import {
  ApiClientError,
  createResponseError,
  requestApi,
} from './ApiClientError';

const GAMES_API_URL = '/api/games';

interface JsonRequest<Result> {
  body?: unknown;
  invalidResponseMessage: string;
  method?: 'GET' | 'POST';
  schema: ResponseSchema<Result>;
  url: string;
}

interface ResponseSchema<Result> {
  safeParse(
    value: unknown
  ): { data: Result; success: true } | { success: false };
}

export interface GameApi {
  cancelTurnDraft(
    this: void,
    gameId: string,
    request: CancelTurnDraftRequest
  ): Promise<GameTurnDraftResponse>;
  completeCardSelection(
    this: void,
    gameId: string,
    request: CompleteCardSelectionRequest
  ): Promise<GameResponse>;
  confirmCardChoice(
    this: void,
    gameId: string,
    request: ConfirmCardChoiceRequest
  ): Promise<GameResponse>;
  confirmTurnDraft(
    this: void,
    gameId: string,
    request: ConfirmTurnDraftRequest
  ): Promise<GameResponse>;
  createGame(this: void, request: CreateGameRequest): Promise<GameResponse>;
  getGame(this: void, gameId: string): Promise<GameResponse>;
  getTurnDraft(this: void, gameId: string): Promise<GameTurnDraftResponse>;
  joinGame(
    this: void,
    gameId: string,
    request: JoinGameRequest
  ): Promise<GameResponse>;
  leaveGame(
    this: void,
    gameId: string,
    request: LeaveGameRequest
  ): Promise<LeaveGameResponse>;
  listTurnHistory(
    this: void,
    gameId: string,
    query: GameTurnHistoryQuery
  ): Promise<GameTurnHistoryResponse>;
  listLobbyGames(this: void): Promise<LobbyGamesResponse>;
  passTurn(
    this: void,
    gameId: string,
    request: PassTurnRequest
  ): Promise<GameResponse>;
  saveTurnDraft(
    this: void,
    gameId: string,
    request: SaveTurnDraftRequest
  ): Promise<GameTurnDraftResponse>;
  startGame(
    this: void,
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse>;
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
  updateGameSettings(
    this: void,
    gameId: string,
    request: UpdateGameSettingsRequest
  ): Promise<GameResponse>;
}

export function createRealGameApi(): GameApi {
  return {
    cancelTurnDraft,
    completeCardSelection,
    confirmCardChoice,
    confirmTurnDraft,
    createGame,
    getGame,
    getTurnDraft,
    joinGame,
    leaveGame,
    listLobbyGames,
    listTurnHistory,
    passTurn,
    saveTurnDraft,
    startGame,
    surrenderGame,
    swapPlayerPositions,
    updateGameSettings,
  };

  function cancelTurnDraft(
    gameId: string,
    request: CancelTurnDraftRequest
  ): Promise<GameTurnDraftResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid turn draft.',
      method: 'POST',
      schema: gameTurnDraftResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/turn-draft/cancel`,
    });
  }

  function confirmTurnDraft(
    gameId: string,
    request: ConfirmTurnDraftRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/turn-draft/confirm`,
    });
  }

  function getTurnDraft(gameId: string): Promise<GameTurnDraftResponse> {
    return requestJson({
      invalidResponseMessage: 'The server returned an invalid turn draft.',
      schema: gameTurnDraftResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/turn-draft`,
    });
  }

  function saveTurnDraft(
    gameId: string,
    request: SaveTurnDraftRequest
  ): Promise<GameTurnDraftResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid turn draft.',
      method: 'POST',
      schema: gameTurnDraftResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/turn-draft`,
    });
  }

  function completeCardSelection(
    gameId: string,
    request: CompleteCardSelectionRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/card-selection/complete`,
    });
  }

  function confirmCardChoice(
    gameId: string,
    request: ConfirmCardChoiceRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/card-choice`,
    });
  }

  function createGame(request: CreateGameRequest): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid created game.',
      method: 'POST',
      schema: gameResponseSchema,
      url: GAMES_API_URL,
    });
  }

  function getGame(gameId: string): Promise<GameResponse> {
    return requestJson({
      invalidResponseMessage: 'The server returned an invalid game state.',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}`,
    });
  }

  function joinGame(
    gameId: string,
    request: JoinGameRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/join`,
    });
  }

  function listLobbyGames(): Promise<LobbyGamesResponse> {
    return requestJson({
      invalidResponseMessage: 'The server returned an invalid game list.',
      schema: lobbyGamesResponseSchema,
      url: GAMES_API_URL,
    });
  }

  function listTurnHistory(
    gameId: string,
    query: GameTurnHistoryQuery
  ): Promise<GameTurnHistoryResponse> {
    const searchParams = new URLSearchParams({ limit: String(query.limit) });

    if (query.beforeSequence !== undefined) {
      searchParams.set('beforeSequence', String(query.beforeSequence));
    }

    return requestJson({
      invalidResponseMessage: 'The server returned invalid turn history.',
      schema: gameTurnHistoryResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/turn-history?${searchParams}`,
    });
  }

  function passTurn(
    gameId: string,
    request: PassTurnRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/pass`,
    });
  }

  function leaveGame(
    gameId: string,
    request: LeaveGameRequest
  ): Promise<LeaveGameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid leave result.',
      method: 'POST',
      schema: leaveGameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/leave`,
    });
  }

  function startGame(
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/start`,
    });
  }

  function swapPlayerPositions(
    gameId: string,
    request: SwapPlayerPositionsRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/swap-positions`,
    });
  }

  function surrenderGame(
    gameId: string,
    request: SurrenderGameRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/surrender`,
    });
  }

  function updateGameSettings(
    gameId: string,
    request: UpdateGameSettingsRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'The server returned an invalid game state.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/settings`,
    });
  }
}

async function requestJson<Result>(
  input: JsonRequest<Result>
): Promise<Result> {
  const response = await requestApi(input.url, {
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(input.body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    method: input.method ?? 'GET',
  });

  if (!response.ok) {
    throw await createResponseError(response);
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch (error) {
    throw new ApiClientError({
      cause: error,
      code: 'invalid_response',
      diagnosticMessage: input.invalidResponseMessage,
    });
  }

  const result = input.schema.safeParse(responseBody);

  if (!result.success) {
    throw new ApiClientError({
      code: 'invalid_response',
      diagnosticMessage: input.invalidResponseMessage,
    });
  }

  return result.data;
}
