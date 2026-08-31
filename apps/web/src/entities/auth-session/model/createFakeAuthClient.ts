import type {
  AvatarPresetId,
  EmailCodeRequestedResponse,
  PublicUser,
  SessionResponse,
  VerifyEmailCodeResponse,
} from '@war-chest/api-contracts';
import { ApiClientError } from '#/shared/api';
import { getFakeBackendClient } from '#/shared/api/getFakeBackendClient';
import {
  type FakeSessionLock,
  acquireFakeSessionLock,
} from './acquireFakeSessionLock';
import type { AuthClient } from './AuthClient';

const FAKE_AUTH_SESSION_ID_STORAGE_KEY = 'war-chest-fake-auth-session-id';
const MAXIMUM_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_AVATAR_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface ClaimedSession {
  lock: FakeSessionLock;
  sessionId: string;
}

export function createFakeAuthClient(): Promise<AuthClient> {
  const backendClient = getFakeBackendClient();
  const sessionStorage = window.sessionStorage;
  let claimedSession: ClaimedSession | null = null;
  let pendingEmail: string | null = null;

  return Promise.resolve({
    backend: 'fake',
    completeEmailRegistration,
    getSession,
    logout,
    removeAvatar,
    requestEmailCode,
    selectAvatarPreset,
    updateDisplayName,
    uploadAvatar,
    verifyEmailCode,
  });

  async function getSession(): Promise<SessionResponse | null> {
    const sessionId = sessionStorage.getItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);

    if (sessionId !== null && !(await claimSession(sessionId))) {
      sessionStorage.removeItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);
      return null;
    }

    const session = await backendClient.getSession(sessionId);

    if (session === null) {
      sessionStorage.removeItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);
      releaseClaimedSession();
      return null;
    }

    return session;
  }

  function requestEmailCode(): Promise<EmailCodeRequestedResponse> {
    const now = Date.now();
    return Promise.resolve({
      expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
      resendAvailableAt: new Date(now + 60 * 1000).toISOString(),
    });
  }

  async function verifyEmailCode(
    email: string,
    code: string
  ): Promise<VerifyEmailCodeResponse> {
    if (code !== '123456') {
      throw new ApiClientError({
        code: 'email_code_invalid',
        diagnosticMessage: 'The fake login code is 123456.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const loginResult = await backendClient.loginExisting(normalizedEmail);

    if (loginResult !== null) {
      const session = await claimLoginSession(loginResult);

      pendingEmail = null;
      return { session, status: 'authenticated' };
    }

    pendingEmail = normalizedEmail;

    return {
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      registrationToken: 'fake-registration-token',
      status: 'registration_required',
    };
  }

  async function completeEmailRegistration(
    _registrationToken: string,
    displayName: string
  ): Promise<SessionResponse> {
    const result = await backendClient.login(
      pendingEmail ?? 'player@example.com',
      displayName
    );
    const session = await claimLoginSession(result);

    pendingEmail = null;
    return session;
  }

  async function logout(): Promise<void> {
    const sessionId = sessionStorage.getItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);

    if (sessionId === null || claimedSession?.sessionId !== sessionId) {
      sessionStorage.removeItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);
      releaseClaimedSession();
      return;
    }

    try {
      await backendClient.logout(sessionId);
    } finally {
      sessionStorage.removeItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);
      releaseClaimedSession();
    }
  }

  function removeAvatar(): Promise<PublicUser> {
    return backendClient.removeAvatar();
  }

  function selectAvatarPreset(presetId: AvatarPresetId): Promise<PublicUser> {
    return backendClient.selectAvatarPreset(presetId);
  }

  function updateDisplayName(displayName: string): Promise<PublicUser> {
    return backendClient.updateDisplayName(displayName);
  }

  async function uploadAvatar(file: File): Promise<PublicUser> {
    if (!SUPPORTED_AVATAR_CONTENT_TYPES.has(file.type)) {
      throw new ApiClientError({
        code: 'avatar_invalid',
        diagnosticMessage: 'The fake avatar must be a supported image.',
      });
    }

    if (file.size > MAXIMUM_AVATAR_SIZE_BYTES) {
      throw new ApiClientError({
        code: 'avatar_too_large',
        diagnosticMessage: 'The fake avatar exceeds the size limit.',
      });
    }

    return backendClient.uploadAvatar(await readFileAsDataUrl(file));
  }

  async function claimLoginSession(
    result: Awaited<ReturnType<typeof backendClient.login>>
  ): Promise<SessionResponse> {
    if (!(await claimSession(result.sessionId))) {
      await backendClient.logout(result.sessionId);
      throw new ApiClientError({
        code: 'internal_error',
        diagnosticMessage: 'The new fake session could not be claimed.',
      });
    }

    sessionStorage.setItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY, result.sessionId);
    return result.session;
  }

  async function claimSession(sessionId: string): Promise<boolean> {
    if (claimedSession?.sessionId === sessionId) {
      return true;
    }

    const lock = await acquireFakeSessionLock(sessionId);

    if (lock === null) {
      return false;
    }

    releaseClaimedSession();
    claimedSession = { lock, sessionId };
    return true;
  }

  function releaseClaimedSession(): void {
    claimedSession?.lock.release();
    claimedSession = null;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('error', () => {
      reject(
        new ApiClientError({
          cause: reader.error,
          code: 'avatar_invalid',
          diagnosticMessage: 'The fake avatar could not be read.',
        })
      );
    });
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(
        new ApiClientError({
          code: 'avatar_invalid',
          diagnosticMessage: 'The fake avatar could not be read.',
        })
      );
    });
    reader.readAsDataURL(file);
  });
}
