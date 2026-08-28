import { ApiClientError } from './ApiClientError';
import { createFakeGameApi } from './createFakeGameApi';
import { subscribeToFakeLobbyUpdates } from './fakeLobbyUpdates';
import type { GameConnection, GameConnectionHandlers } from './gameConnection';

export function createFakeGameConnection(
  handlers: GameConnectionHandlers,
  userId: string
): GameConnection {
  const gameApi = createFakeGameApi(userId);
  const joinedGameIds = new Set<string>();
  let unsubscribe: (() => void) | null = null;

  return {
    connect,
    disconnect,
    join,
    leave,
    synchronize,
  };

  function connect(): void {
    unsubscribe ??= subscribeToFakeLobbyUpdates((message) => {
      if (joinedGameIds.has(message.gameId)) {
        refreshGame(message.gameId);
      }
    });
  }

  function disconnect(): void {
    unsubscribe?.();
    unsubscribe = null;
    joinedGameIds.clear();
  }

  function join(gameId: string): void {
    joinedGameIds.add(gameId);
    refreshGame(gameId);
  }

  function leave(gameId: string): void {
    joinedGameIds.delete(gameId);
  }

  function synchronize(gameId: string): void {
    if (joinedGameIds.has(gameId)) {
      refreshGame(gameId);
    }
  }

  function refreshGame(gameId: string): void {
    void gameApi
      .getGame(gameId)
      .then((game) => handlers.onSnapshot(game))
      .catch((error: unknown) => {
        handlers.onError({
          code: error instanceof ApiClientError ? error.code : 'internal_error',
          gameId,
          message:
            error instanceof Error
              ? error.message
              : 'Fake game state could not be refreshed.',
        });
      });
  }
}
