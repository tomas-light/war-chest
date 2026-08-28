import {
  type SessionResponse,
  sessionResponseSchema,
} from '@war-chest/api-contracts';
import { ApiClientError, createResponseError, requestApi } from '#/shared/api';
import type { AuthClient, AuthProvider } from './AuthClient';

export function createRealAuthClient(): AuthClient {
  return {
    backend: 'real',
    getSession,
    login,
    logout,
  };

  async function getSession(): Promise<SessionResponse | null> {
    const response = await requestApi('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 401) {
      return null;
    }

    return parseSessionResponse(response);
  }

  async function login(
    provider: AuthProvider,
    idToken?: string
  ): Promise<SessionResponse | null> {
    if (provider !== 'google') {
      window.location.assign(`/api/auth/${provider}/start`);
      return null;
    }

    if (idToken === undefined || idToken.trim() === '') {
      throw new ApiClientError({
        code: 'invalid_credentials',
        diagnosticMessage: 'Google did not return an ID token.',
      });
    }

    const response = await requestApi('/api/auth/google', {
      body: JSON.stringify({ idToken }),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    return parseSessionResponse(response);
  }

  async function logout(): Promise<void> {
    const response = await requestApi('/api/auth/logout', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      method: 'POST',
    });

    if (!response.ok) {
      throw await createResponseError(response);
    }
  }
}

async function parseSessionResponse(
  response: Response
): Promise<SessionResponse> {
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
      diagnosticMessage: 'The server returned an invalid session response.',
    });
  }

  const result = sessionResponseSchema.safeParse(responseBody);

  if (!result.success) {
    throw new ApiClientError({
      code: 'invalid_response',
      diagnosticMessage: 'The server returned an invalid session response.',
    });
  }

  return result.data;
}
