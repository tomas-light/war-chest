import { getFakeBackendClient } from './getFakeBackendClient';
import {
  type LobbyConnection,
  type LobbyConnectionHandlers,
} from './lobbyConnection';

export function createFakeLobbyConnection(
  handlers: LobbyConnectionHandlers
): LobbyConnection {
  const backendClient = getFakeBackendClient();
  const subscriptionId = crypto.randomUUID();
  let isConnected = false;
  let unsubscribeFromEvents: (() => void) | null = null;

  return { connect, disconnect };

  function connect(): void {
    if (isConnected) {
      return;
    }

    isConnected = true;
    unsubscribeFromEvents = backendClient.subscribe((event) => {
      if (
        event.name === 'lobby.updated' &&
        event.subscriptionId === subscriptionId
      ) {
        handlers.onUpdated(event.message);
      }
    });
    void backendClient
      .subscribeToLobby(subscriptionId)
      .then(() => {
        if (isConnected) {
          handlers.onSubscribed();
        }
      })
      .catch(() => undefined);
  }

  function disconnect(): void {
    isConnected = false;
    unsubscribeFromEvents?.();
    unsubscribeFromEvents = null;
    void backendClient
      .unsubscribeFromLobby(subscriptionId)
      .catch(() => undefined);
  }
}
