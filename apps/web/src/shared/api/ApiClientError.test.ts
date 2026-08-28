import { describe, expect, test } from 'vitest';
import { createApiClientError, createResponseError } from './ApiClientError';

describe('API client errors', () => {
  test('keeps a known server error code for localization', () => {
    const error = createApiClientError({
      code: 'game_not_found',
      diagnosticMessage: 'Game was not found.',
    });

    expect(error).toMatchObject({
      code: 'game_not_found',
      serverCode: undefined,
    });
  });

  test('maps an unknown server error code to the fallback translation', () => {
    const error = createApiClientError({
      code: 'future_server_code',
      diagnosticMessage: 'A future server error occurred.',
    });

    expect(error).toMatchObject({
      code: 'unknown',
      serverCode: 'future_server_code',
    });
  });

  test('reads a stable error code from an API error response', async () => {
    const response = new Response(
      JSON.stringify({
        error: {
          code: 'invalid_request',
          message: 'The request is invalid.',
        },
      }),
      { status: 400 }
    );

    await expect(createResponseError(response)).resolves.toMatchObject({
      code: 'invalid_request',
      status: 400,
    });
  });

  test('uses the fallback code for a non-JSON API error response', async () => {
    const response = new Response('Bad gateway', { status: 502 });

    await expect(createResponseError(response)).resolves.toEqual(
      expect.objectContaining({
        code: 'unknown',
        status: 502,
      })
    );
  });
});
