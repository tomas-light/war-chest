import type {
  FakeAuthSession,
  FakeDatabase,
  FakeUser,
} from '@war-chest/fake-database';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getFakeDatabase } from '#/shared/api/getFakeDatabase';
import { createFakeAuthClient } from './createFakeAuthClient';

vi.mock('#/shared/api/getFakeDatabase', { spy: true });

const SESSION_ID = '30000000-0000-4000-8000-000000000001';
const USER_ID = '10000000-0000-4000-8000-000000000002';
const CURRENT_DATE = new Date('2026-08-11T10:00:00.000Z');
const EXPIRES_AT = new Date('2026-09-10T10:00:00.000Z');
const USER: FakeUser = {
  createdAt: new Date('2026-08-01T10:00:00.000Z'),
  displayName: 'T User',
  id: USER_ID,
};
const SESSION: FakeAuthSession = {
  createdAt: CURRENT_DATE,
  expiresAt: EXPIRES_AT,
  id: SESSION_ID,
  revokedAt: null,
  userId: USER_ID,
};

describe('fake auth session', () => {
  let fakeDatabase: FakeDatabase;
  let findActive: ReturnType<
    typeof vi.fn<FakeDatabase['sessions']['findActive']>
  >;
  let findByIdentity: ReturnType<
    typeof vi.fn<FakeDatabase['users']['findByIdentity']>
  >;
  let getById: ReturnType<typeof vi.fn<FakeDatabase['users']['getById']>>;
  let revoke: ReturnType<typeof vi.fn<FakeDatabase['sessions']['revoke']>>;
  let save: ReturnType<typeof vi.fn<FakeDatabase['sessions']['save']>>;
  let sessionStorage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
  let storedSessionId: string | null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(CURRENT_DATE);
    storedSessionId = null;
    findActive = vi.fn<FakeDatabase['sessions']['findActive']>();
    findByIdentity = vi.fn<FakeDatabase['users']['findByIdentity']>();
    getById = vi.fn<FakeDatabase['users']['getById']>();
    revoke = vi.fn<FakeDatabase['sessions']['revoke']>();
    save = vi.fn<FakeDatabase['sessions']['save']>();
    fakeDatabase = {
      sessions: { findActive, revoke, save },
      users: { findByIdentity, getById },
    } as unknown as FakeDatabase;
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
    vi.mocked(getFakeDatabase).mockResolvedValue(fakeDatabase);
    vi.stubGlobal('window', { sessionStorage });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(SESSION_ID);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('creates a session for the seeded provider identity', async () => {
    findByIdentity.mockResolvedValue({
      identity: {
        createdAt: USER.createdAt,
        id: '50000000-0000-4000-8000-000000000002',
        provider: 'telegram',
        providerSubject: 'fake-telegram-user',
        userId: USER_ID,
      },
      user: USER,
    });
    const authClient = await createFakeAuthClient();

    const session = await authClient.login('telegram');

    expect(findByIdentity).toHaveBeenCalledWith(
      'telegram',
      'fake-telegram-user'
    );
    expect(save).toHaveBeenCalledWith(SESSION);
    expect(session?.user).toEqual({
      avatarVersion: null,
      displayName: 'T User',
      id: USER_ID,
    });
  });

  test('keeps only the database session id in tab storage', async () => {
    findByIdentity.mockResolvedValue({
      identity: {
        createdAt: USER.createdAt,
        id: '50000000-0000-4000-8000-000000000002',
        provider: 'telegram',
        providerSubject: 'fake-telegram-user',
        userId: USER_ID,
      },
      user: USER,
    });
    const authClient = await createFakeAuthClient();

    await authClient.login('telegram');

    expect(storedSessionId).toBe(SESSION_ID);
  });

  test('restores an active session and its user from the database', async () => {
    storedSessionId = SESSION_ID;
    findActive.mockResolvedValue(SESSION);
    getById.mockResolvedValue(USER);
    const authClient = await createFakeAuthClient();

    const session = await authClient.getSession();

    expect(findActive).toHaveBeenCalledWith(SESSION_ID, CURRENT_DATE);
    expect(getById).toHaveBeenCalledWith(USER_ID);
    expect(session).toEqual({
      expiresAt: EXPIRES_AT.toISOString(),
      user: {
        avatarVersion: null,
        displayName: 'T User',
        id: USER_ID,
      },
    });
  });

  test('removes the tab pointer when its database session is inactive', async () => {
    storedSessionId = SESSION_ID;
    findActive.mockResolvedValue(null);
    const authClient = await createFakeAuthClient();

    expect(await authClient.getSession()).toBeNull();
    expect(storedSessionId).toBeNull();
  });

  test('revokes the database session on logout', async () => {
    storedSessionId = SESSION_ID;
    revoke.mockResolvedValue(true);
    const authClient = await createFakeAuthClient();

    await authClient.logout();

    expect(revoke).toHaveBeenCalledWith(SESSION_ID, CURRENT_DATE);
    expect(storedSessionId).toBeNull();
  });
});
