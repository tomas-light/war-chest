import type { SessionResponse } from '@war-chest/api-contracts';
import { ApiClientError } from '#/shared/api';
import { getFakeBackendClient } from '#/shared/api/getFakeBackendClient';
import {
  type FakeSessionLock,
  acquireFakeSessionLock,
} from './acquireFakeSessionLock';
import type { AuthClient, AuthProvider } from './AuthClient';

const FAKE_AUTH_SESSION_ID_STORAGE_KEY = 'war-chest-fake-auth-session-id';

interface ClaimedSession {
  lock: FakeSessionLock;
  sessionId: string;
}

export function createFakeAuthClient(): Promise<AuthClient> {
  const backendClient = getFakeBackendClient();
  const sessionStorage = window.sessionStorage;
  let claimedSession: ClaimedSession | null = null;

  return Promise.resolve({
    backend: 'fake',
    getSession,
    login,
    logout,
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

  async function login(provider: AuthProvider): Promise<SessionResponse> {
    const result = await backendClient.login(provider);

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
