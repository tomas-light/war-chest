import type {
  GameErrorMessage,
  GameEventsMessage,
  GameSnapshotMessage,
} from '@war-chest/api-contracts';
import { useCallback, useEffect, useEffectEvent, useRef } from 'react';
import {
  type GameConnection,
  createSelectedGameConnection,
} from '#/shared/api';

interface Options {
  gameId: string;
  onError(this: void, message: GameErrorMessage): void;
  onEvents(this: void, message: GameEventsMessage): void;
  onSnapshot(this: void, message: GameSnapshotMessage): void;
  userId: string;
}

export function useGameConnection(options: Options) {
  const { gameId, onError, onEvents, onSnapshot, userId } = options;
  const connectionRef = useRef<GameConnection | null>(null);
  const onErrorEvent = useEffectEvent(onError);
  const onEventsEvent = useEffectEvent(onEvents);
  const onSnapshotEvent = useEffectEvent(onSnapshot);

  useEffect(() => {
    if (gameId === '' || userId === '') {
      return;
    }

    let isCancelled = false;

    void connectToGame();

    return () => {
      isCancelled = true;
      connectionRef.current?.leave(gameId);
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };

    async function connectToGame(): Promise<void> {
      const connection = await createSelectedGameConnection({
        onError(message) {
          onErrorEvent(message);
        },
        onEvents(message) {
          if (message.gameId === gameId) {
            onEventsEvent(message);
          }
        },
        onSnapshot(message) {
          if (message.gameId === gameId) {
            onSnapshotEvent(message);
          }
        },
      });

      if (isCancelled) {
        connection.disconnect();
        return;
      }

      connectionRef.current = connection;
      connection.connect();
      connection.join(gameId);
    }
  }, [gameId, userId]);

  const synchronize = useCallback(
    (afterSequence: number) => {
      connectionRef.current?.synchronize(gameId, afterSequence);
    },
    [gameId]
  );

  return { synchronize };
}
