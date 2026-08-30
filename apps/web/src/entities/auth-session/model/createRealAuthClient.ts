import {
  type AvatarPresetId,
  type EmailCodeRequestedResponse,
  type PublicUser,
  type SessionResponse,
  type VerifyEmailCodeResponse,
  emailCodeRequestedResponseSchema,
  publicUserSchema,
  sessionResponseSchema,
  verifyEmailCodeResponseSchema,
} from '@war-chest/api-contracts';
import { ApiClientError, createResponseError, requestApi } from '#/shared/api';
import type { AuthClient } from './AuthClient';

export function createRealAuthClient(): AuthClient {
  return {
    backend: 'real',
    completeEmailRegistration,
    getSession,
    logout,
    removeAvatar,
    requestEmailCode,
    selectAvatarPreset,
    updateDisplayName,
    uploadAvatar,
    verifyEmailCode,
  };

  async function getSession(): Promise<SessionResponse | null> {
    const response = await requestApi('/api/auth/session', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 401) {
      return null;
    }

    return parseResponse(response, sessionResponseSchema, 'session');
  }

  async function requestEmailCode(
    email: string
  ): Promise<EmailCodeRequestedResponse> {
    const response = await postJson('/api/auth/email/code', { email });
    return parseResponse(
      response,
      emailCodeRequestedResponseSchema,
      'email code'
    );
  }

  async function verifyEmailCode(
    email: string,
    code: string
  ): Promise<VerifyEmailCodeResponse> {
    const response = await postJson('/api/auth/email/verify', { code, email });
    return parseResponse(
      response,
      verifyEmailCodeResponseSchema,
      'email code verification'
    );
  }

  async function completeEmailRegistration(
    registrationToken: string,
    displayName: string
  ): Promise<SessionResponse> {
    const response = await postJson('/api/auth/email/register', {
      displayName,
      registrationToken,
    });
    return parseResponse(response, sessionResponseSchema, 'registration');
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

  async function removeAvatar(): Promise<PublicUser> {
    const response = await requestApi('/api/users/me/avatar', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      method: 'DELETE',
    });
    return parseResponse(response, publicUserSchema, 'updated user');
  }

  async function selectAvatarPreset(
    presetId: AvatarPresetId
  ): Promise<PublicUser> {
    const response = await postJson(
      '/api/users/me/avatar/preset',
      {
        presetId,
      },
      'PUT'
    );
    return parseResponse(response, publicUserSchema, 'updated user');
  }

  async function updateDisplayName(displayName: string): Promise<PublicUser> {
    const response = await postJson('/api/users/me', { displayName }, 'PATCH');
    return parseResponse(response, publicUserSchema, 'updated user');
  }

  async function uploadAvatar(file: File): Promise<PublicUser> {
    const response = await requestApi('/api/users/me/avatar', {
      body: file,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': file.type,
      },
      method: 'PUT',
    });
    return parseResponse(response, publicUserSchema, 'updated user');
  }
}

function postJson(
  path: string,
  body: unknown,
  method: 'PATCH' | 'POST' | 'PUT' = 'POST'
): Promise<Response> {
  return requestApi(path, {
    body: JSON.stringify(body),
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    method,
  });
}

async function parseResponse<Output>(
  response: Response,
  schema: {
    safeParse(
      value: unknown
    ): { data: Output; success: true } | { success: false };
  },
  responseName: string
): Promise<Output> {
  if (!response.ok) {
    throw await createResponseError(response);
  }

  let responseBody: unknown;

  try {
    responseBody = await response.json();
  } catch (error) {
    throw invalidResponse(responseName, error);
  }

  const result = schema.safeParse(responseBody);

  if (!result.success) {
    throw invalidResponse(responseName);
  }

  return result.data;
}

function invalidResponse(
  responseName: string,
  cause?: unknown
): ApiClientError {
  return new ApiClientError({
    cause,
    code: 'invalid_response',
    diagnosticMessage: `The server returned an invalid ${responseName} response.`,
  });
}
