import {
  type CreateGameRequest,
  type GameResponse,
  type JoinGameRequest,
  type LobbyGamesResponse,
  type StartGameRequest,
  type SwapPlayerPositionsRequest,
  apiErrorSchema,
  gameResponseSchema,
  lobbyGamesResponseSchema,
} from '@war-chest/api-contracts';

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
  createGame(this: void, request: CreateGameRequest): Promise<GameResponse>;
  getGame(this: void, gameId: string): Promise<GameResponse>;
  joinGame(
    this: void,
    gameId: string,
    request: JoinGameRequest
  ): Promise<GameResponse>;
  listLobbyGames(this: void): Promise<LobbyGamesResponse>;
  startGame(
    this: void,
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse>;
  swapPlayerPositions(
    this: void,
    gameId: string,
    request: SwapPlayerPositionsRequest
  ): Promise<GameResponse>;
}

export function createRealGameApi(): GameApi {
  return {
    createGame,
    getGame,
    joinGame,
    listLobbyGames,
    startGame,
    swapPlayerPositions,
  };

  function createGame(request: CreateGameRequest): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'Сервер вернул некорректную созданную игру.',
      method: 'POST',
      schema: gameResponseSchema,
      url: GAMES_API_URL,
    });
  }

  function getGame(gameId: string): Promise<GameResponse> {
    return requestJson({
      invalidResponseMessage: 'Сервер вернул некорректное состояние игры.',
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
      invalidResponseMessage: 'Сервер вернул некорректное состояние игры.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/join`,
    });
  }

  function listLobbyGames(): Promise<LobbyGamesResponse> {
    return requestJson({
      invalidResponseMessage: 'Сервер вернул некорректный список игр.',
      schema: lobbyGamesResponseSchema,
      url: GAMES_API_URL,
    });
  }

  function startGame(
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse> {
    return requestJson({
      body: request,
      invalidResponseMessage: 'Сервер вернул некорректное состояние игры.',
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
      invalidResponseMessage: 'Сервер вернул некорректное состояние игры.',
      method: 'POST',
      schema: gameResponseSchema,
      url: `${GAMES_API_URL}/${gameId}/swap-positions`,
    });
  }
}

async function requestJson<Result>(
  input: JsonRequest<Result>
): Promise<Result> {
  const response = await fetch(input.url, {
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
    throw await createApiError(response);
  }

  const responseBody: unknown = await response.json();
  const result = input.schema.safeParse(responseBody);

  if (!result.success) {
    throw new Error(input.invalidResponseMessage);
  }

  return result.data;
}

async function createApiError(response: Response): Promise<Error> {
  try {
    const responseBody: unknown = await response.json();
    const result = apiErrorSchema.safeParse(responseBody);

    if (result.success) {
      return new Error(result.data.error.message);
    }
  } catch {
    // The status fallback also covers an empty or non-JSON response.
  }

  return new Error(`Игровой запрос завершился с кодом ${response.status}.`);
}
