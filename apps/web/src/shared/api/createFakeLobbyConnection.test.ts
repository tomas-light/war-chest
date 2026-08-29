import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type {
  FakeBackendClient,
  FakeBackendEvent,
} from './createFakeBackendClient';
import { createFakeLobbyConnection } from './createFakeLobbyConnection';
import { getFakeBackendClient } from './getFakeBackendClient';
import type { LobbyConnection } from './lobbyConnection';

vi.mock('./getFakeBackendClient', { spy: true });

const GAME_ID = '20000000-0000-4000-8000-000000000001';

describe('fake lobby connection', () => {
  let connection: LobbyConnection | undefined;
  let deliverEvent: ((event: FakeBackendEvent) => void) | undefined;

  beforeEach(() => {
    const subscribe = vi.fn<FakeBackendClient['subscribe']>((listener) => {
      deliverEvent = listener;
      return vi.fn();
    });

    vi.mocked(getFakeBackendClient).mockReturnValue({
      subscribe,
      subscribeToLobby: vi.fn().mockResolvedValue(undefined),
      unsubscribeFromLobby: vi.fn().mockResolvedValue(undefined),
    } as unknown as FakeBackendClient);
  });

  afterEach(() => {
    connection?.disconnect();
    vi.restoreAllMocks();
  });

  test('delivers a fake lobby update to its subscription', async () => {
    const onUpdated = vi.fn();
    connection = createFakeLobbyConnection({
      onSubscribed: vi.fn(),
      onUpdated,
    });
    connection.connect();

    const listener = deliverEvent;

    if (listener === undefined) {
      throw new Error('The fake lobby event listener was not registered.');
    }

    const backendClient = getFakeBackendClient();
    const subscribeToLobby = vi.mocked(backendClient.subscribeToLobby);

    await vi.waitFor(() => expect(subscribeToLobby).toHaveBeenCalledOnce());
    const [subscriptionId] = subscribeToLobby.mock.calls[0] ?? [];

    if (subscriptionId === undefined) {
      throw new Error('The fake lobby subscription id was not provided.');
    }

    listener({
      message: { gameId: GAME_ID },
      name: 'lobby.updated',
      subscriptionId,
    });

    expect(onUpdated).toHaveBeenCalledWith({ gameId: GAME_ID });
  });
});
