import type { SessionResponse } from '@war-chest/api-contracts';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FakeBackendClient } from '#/shared/api/createFakeBackendClient';
import { getFakeBackendClient } from '#/shared/api/getFakeBackendClient';
import { acquireFakeSessionLock } from './acquireFakeSessionLock';
import { createFakeAuthClient } from './createFakeAuthClient';

vi.mock('#/shared/api/getFakeBackendClient', { spy: true });
vi.mock('./acquireFakeSessionLock', { spy: true });

const SESSION_ID = '30000000-0000-4000-8000-000000000001';
const SESSION: SessionResponse = {
  expiresAt: '2026-09-10T10:00:00.000Z',
  user: {
    avatarVersion: null,
    displayName: 'T User',
    id: '10000000-0000-4000-8000-000000000002',
  },
};

describe('fake auth session', () => {
  let getSession: ReturnType<typeof vi.fn<FakeBackendClient['getSession']>>;
  let login: ReturnType<typeof vi.fn<FakeBackendClient['login']>>;
  let logout: ReturnType<typeof vi.fn<FakeBackendClient['logout']>>;
  let releaseSessionLock: ReturnType<typeof vi.fn<() => void>>;
  let sessionStorage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
  let storedSessionId: string | null;

  beforeEach(() => {
    storedSessionId = null;
    getSession = vi.fn<FakeBackendClient['getSession']>();
    login = vi.fn<FakeBackendClient['login']>();
    logout = vi.fn<FakeBackendClient['logout']>();
    releaseSessionLock = vi.fn<() => void>();
    sessionStorage = {
      getItem() {
        return storedSessionId;
      },
      removeItem() {
        storedSessionId = null;
      },
      setItem(_key, value) {
        storedSessionId = value;
      },
    };
    vi.mocked(getFakeBackendClient).mockReturnValue({
      getSession,
      login,
      logout,
    } as unknown as FakeBackendClient);
    vi.mocked(acquireFakeSessionLock).mockResolvedValue({
      release: releaseSessionLock,
    });
    vi.stubGlobal('window', { sessionStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('uses the selected fake provider session', async () => {
    login.mockResolvedValue({ session: SESSION, sessionId: SESSION_ID });
    const authClient = await createFakeAuthClient();

    const session = await authClient.login('telegram');

    expect(login).toHaveBeenCalledWith('telegram');
    expect(session).toEqual(SESSION);
  });

  test('keeps only the fake session id in tab storage', async () => {
    login.mockResolvedValue({ session: SESSION, sessionId: SESSION_ID });
    const authClient = await createFakeAuthClient();

    await authClient.login('telegram');

    expect(storedSessionId).toBe(SESSION_ID);
  });

  test('restores the stored fake session through the backend client', async () => {
    storedSessionId = SESSION_ID;
    getSession.mockResolvedValue(SESSION);
    const authClient = await createFakeAuthClient();

    const session = await authClient.getSession();

    expect(acquireFakeSessionLock).toHaveBeenCalledWith(SESSION_ID);
    expect(getSession).toHaveBeenCalledWith(SESSION_ID);
    expect(session).toEqual(SESSION);
  });

  test('does not restore a fake session claimed by another tab', async () => {
    storedSessionId = SESSION_ID;
    vi.mocked(acquireFakeSessionLock).mockResolvedValue(null);
    const authClient = await createFakeAuthClient();

    expect(await authClient.getSession()).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
    expect(storedSessionId).toBeNull();
  });

  test('removes the tab pointer when its fake session is inactive', async () => {
    storedSessionId = SESSION_ID;
    getSession.mockResolvedValue(null);
    const authClient = await createFakeAuthClient();

    expect(await authClient.getSession()).toBeNull();
    expect(storedSessionId).toBeNull();
    expect(releaseSessionLock).toHaveBeenCalledOnce();
  });

  test('revokes the fake session on logout', async () => {
    storedSessionId = SESSION_ID;
    getSession.mockResolvedValue(SESSION);
    logout.mockResolvedValue();
    const authClient = await createFakeAuthClient();

    await authClient.getSession();
    await authClient.logout();

    expect(logout).toHaveBeenCalledWith(SESSION_ID);
    expect(storedSessionId).toBeNull();
    expect(releaseSessionLock).toHaveBeenCalledOnce();
  });

  test('does not revoke a fake session without ownership', async () => {
    storedSessionId = SESSION_ID;
    const authClient = await createFakeAuthClient();

    await authClient.logout();

    expect(logout).not.toHaveBeenCalled();
    expect(storedSessionId).toBeNull();
  });
});
