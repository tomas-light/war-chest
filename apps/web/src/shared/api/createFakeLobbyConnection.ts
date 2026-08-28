import { subscribeToFakeLobbyUpdates } from './fakeLobbyUpdates';
import {
  type LobbyConnection,
  type LobbyConnectionHandlers,
} from './lobbyConnection';

export function createFakeLobbyConnection(
  handlers: LobbyConnectionHandlers
): LobbyConnection {
  let unsubscribe: (() => void) | null = null;

  return { connect, disconnect };

  function connect(): void {
    unsubscribe ??= subscribeToFakeLobbyUpdates(handlers.onUpdated);
    handlers.onSubscribed();
  }

  function disconnect(): void {
    unsubscribe?.();
    unsubscribe = null;
  }
}
