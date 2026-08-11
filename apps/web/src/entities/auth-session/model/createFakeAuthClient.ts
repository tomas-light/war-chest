import type { SessionResponse } from '@war-chest/api-contracts';
import {
  type FakeAuthSession,
  type FakeUser,
  FAKE_PROVIDER_SUBJECTS,
} from '@war-chest/fake-database';
import { getFakeDatabase } from '#/shared/api/getFakeDatabase';
import type { AuthClient, AuthProvider } from './AuthClient';

const FAKE_AUTH_SESSION_ID_STORAGE_KEY = 'war-chest-fake-auth-session-id';
const FAKE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createFakeAuthClient(): Promise<AuthClient> {
  const database = await getFakeDatabase();
  const sessionStorage = window.sessionStorage;

  return {
    backend: 'fake',
    getSession,
    login,
    logout,
  };

  async function getSession(): Promise<SessionResponse | null> {
    const sessionId = sessionStorage.getItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);

    if (sessionId === null) {
      return null;
    }

    const session = await database.sessions.findActive(sessionId, new Date());

    if (session === null) {
      sessionStorage.removeItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);
      return null;
    }

    const user = await database.users.getById(session.userId);

    if (user === null) {
      throw new Error(
        `Fake session ${session.id} references a missing user ${session.userId}.`
      );
    }

    return createSessionResponse(session, user);
  }

  async function login(provider: AuthProvider): Promise<SessionResponse> {
    const identity = await database.users.findByIdentity(
      provider,
      FAKE_PROVIDER_SUBJECTS[provider]
    );

    if (identity === null) {
      throw new Error(`Seeded fake ${provider} identity was not found.`);
    }

    const createdAt = new Date();
    const session: FakeAuthSession = {
      createdAt,
      expiresAt: new Date(createdAt.getTime() + FAKE_SESSION_TTL_MS),
      id: crypto.randomUUID(),
      revokedAt: null,
      userId: identity.user.id,
    };

    await database.sessions.save(session);
    sessionStorage.setItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY, session.id);

    return createSessionResponse(session, identity.user);
  }

  async function logout(): Promise<void> {
    const sessionId = sessionStorage.getItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);

    if (sessionId === null) {
      return;
    }

    try {
      await database.sessions.revoke(sessionId, new Date());
    } finally {
      sessionStorage.removeItem(FAKE_AUTH_SESSION_ID_STORAGE_KEY);
    }
  }
}

function createSessionResponse(
  session: FakeAuthSession,
  user: FakeUser
): SessionResponse {
  return {
    expiresAt: session.expiresAt.toISOString(),
    user: {
      avatarVersion: null,
      displayName: user.displayName,
      id: user.id,
    },
  };
}
