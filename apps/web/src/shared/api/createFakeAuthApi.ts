import type { SessionResponse } from '@war-chest/api-contracts';
import {
  type FakeAuthSession,
  type FakeDatabase,
  type FakeUser,
} from '@war-chest/fake-database';
import { ApiClientError } from './ApiClientError';
import { createFakePublicUser } from './createFakePublicUser';
import type { FakeLoginResult } from './FakeBackendProtocol';
import { getFakeDatabase } from './getFakeDatabase';

const FAKE_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface FakeAuthApi {
  getSession(
    this: void,
    sessionId: string | null
  ): Promise<SessionResponse | null>;
  login(
    this: void,
    email: string,
    displayName: string
  ): Promise<FakeLoginResult>;
  loginExisting(this: void, email: string): Promise<FakeLoginResult | null>;
  logout(this: void, sessionId: string | null): Promise<void>;
}

export function createFakeAuthApi(): FakeAuthApi {
  return { getSession, login, loginExisting, logout };

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

  async function login(
    email: string,
    displayName: string
  ): Promise<FakeLoginResult> {
    const database = await getFakeDatabase();
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await database.users.findByEmail(normalizedEmail);
    const user: FakeUser = existingUser ?? {
      avatarDataUrl: null,
      avatarPresetId: null,
      createdAt: new Date(),
      displayName,
      email: normalizedEmail,
      id: crypto.randomUUID(),
    };

    await database.users.save(user);

    return createLoginResult(database, user);
  }

  async function loginExisting(email: string): Promise<FakeLoginResult | null> {
    const database = await getFakeDatabase();
    const user = await database.users.findByEmail(email.trim().toLowerCase());

    return user === null ? null : createLoginResult(database, user);
  }

  async function logout(sessionId: string | null): Promise<void> {
    if (sessionId === null) {
      return;
    }

    const database = await getFakeDatabase();
    await database.sessions.revoke(sessionId, new Date());
  }
}

async function createLoginResult(
  database: FakeDatabase,
  user: FakeUser
): Promise<FakeLoginResult> {
  const createdAt = new Date();
  const session: FakeAuthSession = {
    createdAt,
    expiresAt: new Date(createdAt.getTime() + FAKE_SESSION_TTL_MS),
    id: crypto.randomUUID(),
    revokedAt: null,
    userId: user.id,
  };

  await database.sessions.save(session);

  return {
    session: createSessionResponse(session, user),
    sessionId: session.id,
  };
}

function createSessionResponse(
  session: FakeAuthSession,
  user: FakeUser
): SessionResponse {
  return {
    expiresAt: session.expiresAt.toISOString(),
    user: {
      ...createFakePublicUser(user),
    },
  };
}
