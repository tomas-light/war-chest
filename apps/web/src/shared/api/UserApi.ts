import {
  type PublicUser,
  type UserGamesResponse,
  publicUserSchema,
  userGamesResponseSchema,
} from '@war-chest/api-contracts';
import {
  ApiClientError,
  createResponseError,
  requestApi,
} from './ApiClientError';

const USERS_API_URL = '/api/users';

interface ResponseSchema<Result> {
  safeParse(
    value: unknown
  ): { data: Result; success: true } | { success: false };
}

export interface UserApi {
  getPublicUser(this: void, userId: string): Promise<PublicUser>;
  listFinishedGames(
    this: void,
    userId: string,
    cursor?: string
  ): Promise<UserGamesResponse>;
}

export function createRealUserApi(): UserApi {
  return { getPublicUser, listFinishedGames };

  function getPublicUser(userId: string): Promise<PublicUser> {
    return requestJson({
      invalidResponseMessage: 'The server returned an invalid user profile.',
      schema: publicUserSchema,
      url: getUserUrl(userId),
    });
  }

  function listFinishedGames(
    userId: string,
    cursor?: string
  ): Promise<UserGamesResponse> {
    const query =
      cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`;

    return requestJson({
      invalidResponseMessage: 'The server returned an invalid game history.',
      schema: userGamesResponseSchema,
      url: `${getUserUrl(userId)}/games${query}`,
    });
  }
}

interface JsonRequest<Result> {
  invalidResponseMessage: string;
  schema: ResponseSchema<Result>;
  url: string;
}

async function requestJson<Result>(
  input: JsonRequest<Result>
): Promise<Result> {
  const response = await requestApi(input.url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
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

function getUserUrl(userId: string): string {
  return `${USERS_API_URL}/${encodeURIComponent(userId)}`;
}
