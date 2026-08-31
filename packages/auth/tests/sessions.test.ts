import type { Database } from '@war-chest/database';
import { expect, test } from 'vitest';
import type { AuthConfig } from '../src/config/index.js';
import { createSession } from '../src/sessions.js';

test('stores only a hash and prepares a secure server session cookie', async () => {
  let insertedSession: InsertedSession | undefined;
  const database = {
    insert: insertSession,
  } as unknown as Database;
  const now = new Date('2026-07-28T12:00:00.000Z');
  const config: AuthConfig = {
    AUTH_COOKIE_SAME_SITE: 'lax',
    AUTH_COOKIE_SECURE: true,
    AUTH_EMAIL_CODE_HMAC_SECRET:
      'test-secret-that-is-longer-than-32-characters',
    AUTH_EMAIL_CODE_IP_MAX_REQUESTS_PER_HOUR: 20,
    AUTH_EMAIL_CODE_MAX_FAILURES_PER_HOUR: 5,
    AUTH_EMAIL_CODE_MAX_REQUESTS_PER_HOUR: 5,
    AUTH_EMAIL_CODE_RESEND_DELAY_SECONDS: 60,
    AUTH_EMAIL_CODE_TTL_MINUTES: 10,
    AUTH_REGISTRATION_TICKET_TTL_MINUTES: 15,
    AUTH_SESSION_COOKIE_NAME: 'war_chest_session',
    AUTH_SESSION_TTL_MINUTES: 60,
  };
  const result = await createSession({
    config,
    database,
    now,
    user: {
      avatarVersion: null,
      displayName: 'Player',
      id: 'user-id',
    },
  });

  expect(insertedSession).toBeDefined();

  if (insertedSession === undefined) {
    throw new Error('Session was not stored');
  }

  expect(insertedSession.tokenHash).not.toBe(result.cookie.value);
  expect(Buffer.from(result.cookie.value, 'base64url')).toHaveLength(32);
  expect(insertedSession.expiresAt.toISOString()).toBe(
    '2026-07-28T13:00:00.000Z'
  );
  expect(result.cookie.options).toEqual({
    expires: new Date('2026-07-28T13:00:00.000Z'),
    httpOnly: true,
    maxAge: 3600,
    path: '/',
    sameSite: 'lax',
    secure: true,
  });

  function insertSession(): {
    values(session: InsertedSession): Promise<void>;
  } {
    return { values };
  }

  function values(session: InsertedSession): Promise<void> {
    insertedSession = session;
    return Promise.resolve();
  }
});

interface InsertedSession {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
}
