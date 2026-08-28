import {
  type ApiErrorCode,
  API_ERROR_CODES,
  apiErrorSchema,
} from '@war-chest/api-contracts';

const CLIENT_ERROR_CODES = [
  'external_provider_unavailable',
  'invalid_response',
  'network_error',
  'unknown',
] as const;

export type ApiClientErrorCode =
  ApiErrorCode | (typeof CLIENT_ERROR_CODES)[number];

interface ApiClientErrorInput {
  cause?: unknown;
  code: ApiClientErrorCode;
  diagnosticMessage: string;
  serverCode?: string;
  status?: number;
}

interface CreateApiClientErrorInput {
  cause?: unknown;
  code: string;
  diagnosticMessage: string;
  status?: number;
}

export class ApiClientError extends Error {
  readonly code: ApiClientErrorCode;
  readonly serverCode: string | undefined;
  readonly status: number | undefined;

  constructor(input: ApiClientErrorInput) {
    super(input.diagnosticMessage, { cause: input.cause });
    this.name = 'ApiClientError';
    this.code = input.code;
    this.serverCode = input.serverCode;
    this.status = input.status;
  }
}

export function createApiClientError(
  input: CreateApiClientErrorInput
): ApiClientError {
  if (isApiClientErrorCode(input.code)) {
    return new ApiClientError({
      cause: input.cause,
      code: input.code,
      diagnosticMessage: input.diagnosticMessage,
      status: input.status,
    });
  }

  return new ApiClientError({
    cause: input.cause,
    code: 'unknown',
    diagnosticMessage: input.diagnosticMessage,
    serverCode: input.code,
    status: input.status,
  });
}

export async function createResponseError(
  response: Response
): Promise<ApiClientError> {
  try {
    const responseBody: unknown = await response.json();
    const result = apiErrorSchema.safeParse(responseBody);

    if (result.success) {
      return createApiClientError({
        code: result.data.error.code,
        diagnosticMessage: result.data.error.message,
        status: response.status,
      });
    }
  } catch {
    // The status fallback also covers an empty or non-JSON response.
  }

  return new ApiClientError({
    code: 'unknown',
    diagnosticMessage: `API request failed with status ${response.status}.`,
    status: response.status,
  });
}

export async function requestApi(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw new ApiClientError({
      cause: error,
      code: 'network_error',
      diagnosticMessage: 'API request could not reach the server.',
    });
  }
}

function isApiClientErrorCode(value: string): value is ApiClientErrorCode {
  return (
    API_ERROR_CODES.some((code) => code === value) ||
    CLIENT_ERROR_CODES.some((code) => code === value)
  );
}
