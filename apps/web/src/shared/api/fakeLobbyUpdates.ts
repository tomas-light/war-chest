import {
  type LobbyUpdatedMessage,
  lobbyUpdatedMessageSchema,
} from '@war-chest/api-contracts';

const FAKE_LOBBY_CHANNEL_NAME = 'war-chest:fake-lobby';
const updateListeners = new Set<(message: LobbyUpdatedMessage) => void>();

export function publishFakeLobbyUpdate(message: LobbyUpdatedMessage): void {
  if (typeof BroadcastChannel === 'undefined') {
    for (const listener of updateListeners) {
      listener(message);
    }

    return;
  }

  const channel = new BroadcastChannel(FAKE_LOBBY_CHANNEL_NAME);
  channel.postMessage(message);
  channel.close();
}

export function subscribeToFakeLobbyUpdates(
  listener: (message: LobbyUpdatedMessage) => void
): () => void {
  const channel = createChannel();
  updateListeners.add(listener);

  return unsubscribe;

  function createChannel(): BroadcastChannel | null {
    if (typeof BroadcastChannel === 'undefined') {
      return null;
    }

    const createdChannel = new BroadcastChannel(FAKE_LOBBY_CHANNEL_NAME);
    createdChannel.addEventListener('message', receiveMessage);

    return createdChannel;
  }

  function receiveMessage(event: MessageEvent<unknown>): void {
    const result = lobbyUpdatedMessageSchema.safeParse(event.data);

    if (result.success) {
      listener(result.data);
    }
  }

  function unsubscribe(): void {
    updateListeners.delete(listener);
    channel?.removeEventListener('message', receiveMessage);
    channel?.close();
  }
}
