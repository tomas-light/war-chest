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
    AUTH_AVATAR_FETCH_TIMEOUT_MS: 5000,
    AUTH_AVATAR_MAX_SOURCE_BYTES: 1048576,
    AUTH_AVATAR_SIZE_PX: 256,
    AUTH_COOKIE_SAME_SITE: 'lax',
    AUTH_COOKIE_SECURE: true,
    AUTH_OAUTH_STATE_TTL_MINUTES: 10,
    AUTH_SESSION_COOKIE_NAME: 'war_chest_session',
    AUTH_SESSION_TTL_MINUTES: 60,
    AUTH_SUCCESS_REDIRECT_URL: 'https://example.com',
    GOOGLE_CLIENT_ID: 'google-client',
    TELEGRAM_AUTHORIZATION_ENDPOINT: 'https://oauth.telegram.org/auth',
    TELEGRAM_CLIENT_ID: 'telegram-client',
    TELEGRAM_CLIENT_SECRET: 'telegram-secret',
    TELEGRAM_ISSUER: 'https://oauth.telegram.org',
    TELEGRAM_JWKS_ENDPOINT: 'https://oauth.telegram.org/.well-known/jwks.json',
    TELEGRAM_REDIRECT_URI: 'https://example.com/auth/telegram/callback',
    TELEGRAM_TOKEN_ENDPOINT: 'https://oauth.telegram.org/token',
    YANDEX_AUTHORIZATION_ENDPOINT: 'https://oauth.yandex.ru/authorize',
    YANDEX_CLIENT_ID: 'yandex-client',
    YANDEX_CLIENT_SECRET: 'yandex-secret',
    YANDEX_PROFILE_ENDPOINT: 'https://login.yandex.ru/info',
    YANDEX_REDIRECT_URI: 'https://example.com/auth/yandex/callback',
    YANDEX_TOKEN_ENDPOINT: 'https://oauth.yandex.ru/token',
  };
  const result = await createSession(
    database,
    {
      avatarHash: null,
      displayName: 'Player',
      id: 'user-id',
    },
    config,
    now
  );

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
