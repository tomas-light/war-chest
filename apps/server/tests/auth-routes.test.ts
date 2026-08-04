import type { Auth, AuthSession, SessionCookie } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../src/app.js';

describe('auth session routes', () => {
  let app: FastifyInstance;
  let getSession: ReturnType<typeof vi.fn<Auth['getSession']>>;
  let logout: ReturnType<typeof vi.fn<Auth['logout']>>;

  beforeEach(() => {
    getSession = vi.fn<Auth['getSession']>();
    logout = vi.fn<Auth['logout']>();

    const auth = {
      getSession,
      logout,
      sessionCookieName: 'war_chest_session',
      successRedirectUrl: 'http://localhost:5173',
    } as unknown as Auth;
    const databaseConnection = {
      checkConnection: vi.fn(),
      close: vi.fn(),
    } as unknown as DatabaseConnection;

    app = createApp({ auth, databaseConnection, logger: false });
  });

  afterEach(async () => {
    await app.close();
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
      url: '/auth/session',
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
      url: '/auth/session',
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
      url: '/auth/session',
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
      url: '/auth/logout',
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
      url: '/auth/logout',
    });

    expect(logout).toHaveBeenCalledWith('');
    expect(response.statusCode).toBe(204);
  });
});
