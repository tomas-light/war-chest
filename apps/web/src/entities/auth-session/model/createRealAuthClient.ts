import {
  type SessionResponse,
  apiErrorSchema,
  sessionResponseSchema,
} from '@war-chest/api-contracts';
import type { AuthClient, AuthProvider } from './AuthClient';

const AUTH_API_URL = '/api/auth';

export function createRealAuthClient(): AuthClient {
  return {
    backend: 'real',
    getSession,
    login,
    logout,
  };

  async function getSession(): Promise<SessionResponse | null> {
    const response = await fetch(`${AUTH_API_URL}/session`, {
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
      window.location.assign(`${AUTH_API_URL}/${provider}/start`);
      return null;
    }

    if (idToken === undefined || idToken.trim() === '') {
      throw new Error('Google did not return an ID token.');
    }

    const response = await fetch(`${AUTH_API_URL}/google`, {
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
    const response = await fetch(`${AUTH_API_URL}/logout`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      method: 'POST',
    });

    if (!response.ok) {
      throw await createApiError(response);
    }
  }
}

async function parseSessionResponse(
  response: Response
): Promise<SessionResponse> {
  if (!response.ok) {
    throw await createApiError(response);
  }

  const responseBody: unknown = await response.json();
  const result = sessionResponseSchema.safeParse(responseBody);

  if (!result.success) {
    throw new Error('The server returned an invalid session response.');
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
    // The status-based fallback below also covers a non-JSON response.
  }

  return new Error(
    `Authentication request failed with status ${response.status}.`
  );
}
