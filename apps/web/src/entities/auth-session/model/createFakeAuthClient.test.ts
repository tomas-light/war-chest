import type { SessionResponse } from '@war-chest/api-contracts';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FakeBackendClient } from '#/shared/api/createFakeBackendClient';
import { getFakeBackendClient } from '#/shared/api/getFakeBackendClient';
import { acquireFakeSessionLock } from './acquireFakeSessionLock';
import { createFakeAuthClient } from './createFakeAuthClient';

vi.mock('#/shared/api/getFakeBackendClient', () => ({
  getFakeBackendClient: vi.fn(),
}));
vi.mock('./acquireFakeSessionLock', () => ({
  acquireFakeSessionLock: vi.fn(),
}));

describe('fake auth client email verification', () => {
  const session: SessionResponse = {
    expiresAt: '2026-09-30T12:00:00.000Z',
    user: {
      avatarVersion: 'preset:cavalry',
      displayName: 'Existing Player',
      id: '10000000-0000-4000-8000-000000000010',
    },
  };
  let backendClient: FakeBackendClient;
  let loginExisting: ReturnType<typeof vi.fn>;
  let sessionStorage: {
    getItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    loginExisting = vi.fn();
    sessionStorage = {
      getItem: vi.fn().mockReturnValue(null),
      removeItem: vi.fn(),
      setItem: vi.fn(),
    };
    backendClient = {
      loginExisting,
      logout: vi.fn(),
    } as unknown as FakeBackendClient;

    vi.mocked(getFakeBackendClient).mockReturnValue(backendClient);
    vi.mocked(acquireFakeSessionLock).mockResolvedValue({
      release: vi.fn(),
    });
    vi.stubGlobal('window', { sessionStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('authenticates an existing fake user without requesting a nickname', async () => {
    loginExisting.mockResolvedValue({
      session,
      sessionId: 'existing-session',
    });
    const client = await createFakeAuthClient();

    const result = await client.verifyEmailCode(
      ' Existing@Example.com ',
      '123456'
    );

    expect(result).toEqual({ session, status: 'authenticated' });
    expect(loginExisting).toHaveBeenCalledWith('existing@example.com');
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'war-chest-fake-auth-session-id',
      'existing-session'
    );
  });

  test('requests a nickname when the fake email has no user', async () => {
    loginExisting.mockResolvedValue(null);
    const client = await createFakeAuthClient();

    const result = await client.verifyEmailCode(
      'new-player@example.com',
      '123456'
    );

    expect(result.status).toBe('registration_required');
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });
});
