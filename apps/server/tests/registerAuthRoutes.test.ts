import {
  type Auth,
  type AuthSession,
  type SessionCookie,
  AuthError,
} from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/createApp.js';

describe('auth session routes', () => {
  let app: FastifyInstance;
  let beginTelegramLogin: ReturnType<typeof vi.fn<Auth['beginTelegramLogin']>>;
  let beginYandexLogin: ReturnType<typeof vi.fn<Auth['beginYandexLogin']>>;
  let completeTelegramLogin: ReturnType<
    typeof vi.fn<Auth['completeTelegramLogin']>
  >;
  let completeYandexLogin: ReturnType<
    typeof vi.fn<Auth['completeYandexLogin']>
  >;
  let getSession: ReturnType<typeof vi.fn<Auth['getSession']>>;
  let loginWithGoogle: ReturnType<typeof vi.fn<Auth['loginWithGoogle']>>;
  let logout: ReturnType<typeof vi.fn<Auth['logout']>>;

  beforeEach(() => {
    beginTelegramLogin = vi.fn<Auth['beginTelegramLogin']>();
    beginYandexLogin = vi.fn<Auth['beginYandexLogin']>();
    completeTelegramLogin = vi.fn<Auth['completeTelegramLogin']>();
    completeYandexLogin = vi.fn<Auth['completeYandexLogin']>();
    getSession = vi.fn<Auth['getSession']>();
    loginWithGoogle = vi.fn<Auth['loginWithGoogle']>();
    logout = vi.fn<Auth['logout']>();

    const auth = {
      beginTelegramLogin,
      beginYandexLogin,
      completeTelegramLogin,
      completeYandexLogin,
      getSession,
      loginWithGoogle,
      logout,
      sessionCookieName: 'war_chest_session',
      successRedirectUrl: 'http://localhost:5173',
    } as unknown as Auth;
    const databaseConnection = {
      checkConnection: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseConnection;

    app = createApp({
      auth,
      databaseConnection,
      disconnectedPlayerTimeoutMinutes: 15,
      featureFlagsService: { read: vi.fn() },
    });
  });

  afterEach(async () => {
    await app.close();
  });

  test('creates a session from a Google ID token', async () => {
    loginWithGoogle.mockResolvedValue({
      cookie: {
        name: 'war_chest_session',
        options: {
          expires: new Date('2026-09-03T10:00:00.000Z'),
          httpOnly: true,
          maxAge: 3600,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
        value: 'session-token',
      },
      session: {
        expiresAt: new Date('2026-09-03T10:00:00.000Z'),
        user: {
          avatarHash: null,
          displayName: 'Ada',
          id: 'user-1',
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      payload: { idToken: 'google-id-token' },
      url: '/api/auth/google',
    });

    expect(loginWithGoogle).toHaveBeenCalledWith('google-id-token');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toContain(
      'war_chest_session=session-token'
    );
    expect(response.json()).toEqual({
      expiresAt: '2026-09-03T10:00:00.000Z',
      user: {
        avatarVersion: null,
        displayName: 'Ada',
        id: 'user-1',
      },
    });
  });

  test('rejects a Google login without an ID token', async () => {
    const response = await app.inject({
      method: 'POST',
      payload: { idToken: '' },
      url: '/api/auth/google',
    });

    expect(loginWithGoogle).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'invalid_request',
        message: 'Google ID token is required.',
      },
    });
  });

  test('starts Telegram login with the OAuth state cookie', async () => {
    beginTelegramLogin.mockReturnValue({
      stateCookie: {
        name: 'war_chest_session_telegram_oauth_state',
        options: {
          expires: new Date('2026-08-10T10:10:00.000Z'),
          httpOnly: true,
          maxAge: 600,
          path: '/api/auth/telegram/callback',
          sameSite: 'lax',
          secure: false,
        },
        value: 'oauth-state',
      },
      url: 'https://oauth.telegram.org/auth?state=oauth-state',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/telegram/start',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'https://oauth.telegram.org/auth?state=oauth-state'
    );
    expect(response.headers['set-cookie']).toContain(
      'war_chest_session_telegram_oauth_state=oauth-state'
    );
  });

  test('completes Yandex login and redirects to the web application', async () => {
    completeYandexLogin.mockResolvedValue({
      cookie: {
        name: 'war_chest_session',
        options: {
          expires: new Date('2026-09-03T10:00:00.000Z'),
          httpOnly: true,
          maxAge: 3600,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
        value: 'session-token',
      },
      session: {
        expiresAt: new Date('2026-09-03T10:00:00.000Z'),
        user: {
          avatarHash: null,
          displayName: 'Yandex user',
          id: 'user-2',
        },
      },
    });

    const response = await app.inject({
      headers: {
        cookie: 'war_chest_session_yandex_oauth_state=oauth-state',
      },
      method: 'GET',
      url: '/api/auth/yandex/callback?code=oauth-code&state=oauth-state',
    });

    expect(completeYandexLogin).toHaveBeenCalledWith(
      'oauth-code',
      'oauth-state',
      'oauth-state'
    );
    const setCookieHeader = String(response.headers['set-cookie']);

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('http://localhost:5173');
    expect(setCookieHeader).toContain('war_chest_session=session-token');
    expect(setCookieHeader).toContain('war_chest_session_yandex_oauth_state=;');
  });

  test('redirects a disabled provider to the localized login page', async () => {
    beginYandexLogin.mockImplementation(() => {
      throw new AuthError('provider_disabled', 'Yandex is not configured.');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/yandex/start',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'http://localhost:5173/login?authError=provider_disabled'
    );
  });

  test('redirects an invalid OAuth callback to the localized login page', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/telegram/callback',
    });

    expect(completeTelegramLogin).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'http://localhost:5173/login?authError=invalid_request'
    );
  });

  test('redirects an expired OAuth state to the localized login page', async () => {
    completeTelegramLogin.mockRejectedValue(
      new AuthError('invalid_oauth_state', 'OAuth state expired.')
    );

    const response = await app.inject({
      headers: {
        cookie: 'war_chest_session_telegram_oauth_state=oauth-state',
      },
      method: 'GET',
      url: '/api/auth/telegram/callback?code=oauth-code&state=oauth-state',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe(
      'http://localhost:5173/login?authError=invalid_oauth_state'
    );
  });

  test('returns the active session from the configured cookie', async () => {
    const session: AuthSession = {
      expiresAt: new Date('2026-09-03T10:00:00.000Z'),
      user: {
        avatarHash: 'avatar-hash',
        displayName: 'Ada',
        id: 'user-1',
      },
    };
    getSession.mockResolvedValue(session);

    const response = await app.inject({
      headers: { cookie: 'war_chest_session=session-token' },
      method: 'GET',
      url: '/api/auth/session',
    });

    expect(getSession).toHaveBeenCalledWith('session-token');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      expiresAt: '2026-09-03T10:00:00.000Z',
      user: {
        avatarVersion: 'avatar-hash',
        displayName: 'Ada',
        id: 'user-1',
      },
    });
  });

  test('provides the resolved session to protected route handlers', async () => {
    const session: AuthSession = {
      expiresAt: new Date('2026-09-03T10:00:00.000Z'),
      user: {
        avatarHash: null,
        displayName: 'Grace',
        id: 'user-2',
      },
    };
    getSession.mockResolvedValue(session);
    app.get(
      '/protected',
      { preHandler: app.requireAuthSession },
      function getProtectedSession(request) {
        return request.authSession;
      }
    );

    const response = await app.inject({
      headers: { cookie: 'war_chest_session=session-token' },
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      expiresAt: '2026-09-03T10:00:00.000Z',
      user: session.user,
    });
  });

  test('rejects a request without a session cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/session',
    });

    expect(getSession).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      error: {
        code: 'unauthorized',
        message: 'Authentication is required.',
      },
    });
  });

  test('rejects an unknown or expired session token', async () => {
    getSession.mockResolvedValue(null);

    const response = await app.inject({
      headers: { cookie: 'war_chest_session=expired-token' },
      method: 'GET',
      url: '/api/auth/session',
    });

    expect(response.statusCode).toBe(401);
  });

  test('revokes the session and clears its cookie on logout', async () => {
    const clearedCookie: SessionCookie = {
      name: 'war_chest_session',
      options: {
        expires: new Date(0),
        httpOnly: true,
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: false,
      },
      value: '',
    };
    logout.mockResolvedValue(clearedCookie);

    const response = await app.inject({
      headers: { cookie: 'war_chest_session=session-token' },
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(logout).toHaveBeenCalledWith('session-token');
    expect(response.statusCode).toBe(204);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toContain(
      'war_chest_session=; Max-Age=0'
    );
    expect(response.headers['set-cookie']).toContain(
      'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    );
    expect(response.headers['set-cookie']).toContain('Path=/');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Lax');
  });

  test('logout remains safe without a session cookie', async () => {
    const clearedCookie: SessionCookie = {
      name: 'war_chest_session',
      options: {
        expires: new Date(0),
        httpOnly: true,
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: false,
      },
      value: '',
    };
    logout.mockResolvedValue(clearedCookie);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    });

    expect(logout).toHaveBeenCalledWith('');
    expect(response.statusCode).toBe(204);
  });
});
