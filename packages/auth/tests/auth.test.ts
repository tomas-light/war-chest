import type { Database } from '@war-chest/database';
import { afterEach, expect, test, vi } from 'vitest';
import { createAuth } from '../src/auth.js';
import type { AuthConfig } from '../src/config/index.js';

afterEach(() => {
  vi.useRealTimers();
});

test('uses configured OAuth state TTL for the state cookie', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-02T12:00:00.000Z'));
  const config: AuthConfig = {
    AUTH_AVATAR_FETCH_TIMEOUT_MS: 5000,
    AUTH_AVATAR_MAX_SOURCE_BYTES: 1048576,
    AUTH_AVATAR_SIZE_PX: 256,
    AUTH_COOKIE_SAME_SITE: 'lax',
    AUTH_COOKIE_SECURE: true,
    AUTH_OAUTH_STATE_TTL_MINUTES: 2,
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
  const auth = createAuth({
    config,
    database: {} as Database,
  });
  const authorization = auth.beginYandexLogin();

  expect(authorization.stateCookie.options.maxAge).toBe(120);
  expect(authorization.stateCookie.options.expires).toEqual(
    new Date('2026-08-02T12:02:00.000Z')
  );
});
