import { ApiClientError } from './ApiClientError';
import type { GameConnection, GameConnectionHandlers } from './gameConnection';
import { getFakeBackendClient } from './getFakeBackendClient';

export function createFakeGameConnection(
  handlers: GameConnectionHandlers
): GameConnection {
  const backendClient = getFakeBackendClient();
  const subscriptionId = crypto.randomUUID();
  let isConnected = false;
  let unsubscribeFromEvents: (() => void) | null = null;

  return {
    connect,
    disconnect,
    join,
    leave,
    synchronize,
  };

  function connect(): void {
    if (isConnected) {
      return;
    }

    isConnected = true;
    unsubscribeFromEvents = backendClient.subscribe((event) => {
      if (event.subscriptionId !== subscriptionId) {
        return;
      }

      if (event.name === 'game.error') {
        handlers.onError(event.message);
      } else if (event.name === 'game.snapshot') {
        handlers.onSnapshot(event.message);
      }
    });
  }

  function disconnect(): void {
    isConnected = false;
    unsubscribeFromEvents?.();
    unsubscribeFromEvents = null;
    void backendClient
      .disconnectGameConnection(subscriptionId)
      .catch(() => undefined);
  }

  function join(gameId: string): void {
    void backendClient
      .joinGameConnection(gameId, subscriptionId)
      .then((game) => {
        if (isConnected) {
          handlers.onSnapshot(game);
        }
      })
      .catch((error: unknown) => {
        handleError(error, gameId);
      });
  }

  function leave(gameId: string): void {
    void backendClient
      .leaveGameConnection(gameId, subscriptionId)
      .catch((error: unknown) => {
        handleError(error, gameId);
      });
  }

  function synchronize(gameId: string, afterSequence: number): void {
    void backendClient
      .synchronizeGameConnection(afterSequence, gameId, subscriptionId)
      .then((game) => {
        if (isConnected) {
          handlers.onSnapshot(game);
        }
      })
      .catch((error: unknown) => {
        handleError(error, gameId);
      });
  }

  function handleError(error: unknown, gameId: string): void {
    if (!isConnected) {
      return;
    }

    handlers.onError({
      code: error instanceof ApiClientError ? error.code : 'internal_error',
      gameId,
      message:
        error instanceof Error
          ? error.message
          : 'Fake game state could not be refreshed.',
    });
  }
}
