import type { SessionResponse } from '@war-chest/api-contracts';
import {
  type FakeAuthSession,
  type FakeUser,
  FAKE_PROVIDER_SUBJECTS,
} from '@war-chest/fake-database';
import { ApiClientError } from './ApiClientError';
import type { FakeAuthProvider, FakeLoginResult } from './FakeBackendProtocol';
import { getFakeDatabase } from './getFakeDatabase';

const FAKE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface FakeAuthApi {
  getSession(
    this: void,
    sessionId: string | null
  ): Promise<SessionResponse | null>;
  login(this: void, provider: FakeAuthProvider): Promise<FakeLoginResult>;
  logout(this: void, sessionId: string | null): Promise<void>;
}

export function createFakeAuthApi(): FakeAuthApi {
  return { getSession, login, logout };

  async function getSession(
    sessionId: string | null
  ): Promise<SessionResponse | null> {
    if (sessionId === null) {
      return null;
    }

    const database = await getFakeDatabase();
    const session = await database.sessions.findActive(sessionId, new Date());

    if (session === null) {
      return null;
    }

    const user = await database.users.getById(session.userId);

    if (user === null) {
      throw new ApiClientError({
        code: 'invalid_response',
        diagnosticMessage: `Fake session ${session.id} references a missing user ${session.userId}.`,
      });
    }

    return createSessionResponse(session, user);
  }

  async function login(provider: FakeAuthProvider): Promise<FakeLoginResult> {
    const database = await getFakeDatabase();
    const identity = await database.users.findByIdentity(
      provider,
      FAKE_PROVIDER_SUBJECTS[provider]
    );

    if (identity === null) {
      throw new ApiClientError({
        code: 'invalid_response',
        diagnosticMessage: `Seeded fake ${provider} identity was not found.`,
      });
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

    return {
      session: createSessionResponse(session, identity.user),
      sessionId: session.id,
    };
  }

  async function logout(sessionId: string | null): Promise<void> {
    if (sessionId === null) {
      return;
    }

    const database = await getFakeDatabase();
    await database.sessions.revoke(sessionId, new Date());
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
