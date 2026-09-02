import type { GameUpdate, GameUpdateListener } from './GameServiceTypes.js';

export interface GameUpdatePublisher {
  close(this: void): void;
  notify(this: void, update: GameUpdate): void;
  subscribe(this: void, listener: GameUpdateListener): () => void;
}

export function createGameUpdatePublisher(): GameUpdatePublisher {
  const updateListeners = new Set<GameUpdateListener>();

  return { close, notify, subscribe };

  function close(): void {
    updateListeners.clear();
  }

  function notify(update: GameUpdate): void {
    for (const listener of updateListeners) {
      void Promise.resolve()
        .then(() => listener(update))
        .catch(() => undefined);
    }
  }

  function subscribe(listener: GameUpdateListener): () => void {
    updateListeners.add(listener);

    return unsubscribe;

    function unsubscribe(): void {
      updateListeners.delete(listener);
    }
  }
}
