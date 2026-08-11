import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRealAuthClient } from './createRealAuthClient';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('real auth session', () => {
  test('returns null when the server has no active session', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    const session = await createRealAuthClient().getSession();

    expect(session).toBeNull();
  });

  test('parses the active server session', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      Response.json({
        expiresAt: '2026-09-03T10:00:00.000Z',
        user: {
          avatarVersion: null,
          displayName: 'Ada',
          id: 'user-1',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const session = await createRealAuthClient().getSession();

    expect(session?.user.displayName).toBe('Ada');
  });

  test('sends the Google ID token to the server', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      Response.json({
        expiresAt: '2026-09-03T10:00:00.000Z',
        user: {
          avatarVersion: null,
          displayName: 'Ada',
          id: 'user-1',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await createRealAuthClient().login('google', 'google-id-token');

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/google', {
      body: JSON.stringify({ idToken: 'google-id-token' }),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  });

  test('surfaces the server error message from a failed login', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            code: 'provider_disabled',
            message: 'The selected login provider is not configured.',
          },
        },
        { status: 503 }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createRealAuthClient().login('google', 'google-id-token')
    ).rejects.toThrow('The selected login provider is not configured.');
  });
});
