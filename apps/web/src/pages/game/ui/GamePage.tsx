import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import { useStore } from 'zustand';
import { createGameSessionStore } from '#/entities/game-session';
import {
  type GameConnection,
  createSelectedGameConnection,
} from '#/shared/api';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';

export function GamePage() {
  const { gameId } = useParams();
  const gameSessionStore = useMemo(() => createGameSessionStore(), []);
  const synchronizationStatus = useStore(
    gameSessionStore,
    (state) => state.synchronizationStatus
  );

  useEffect(() => {
    if (gameId === undefined) {
      return;
    }

    const selectedGameId = gameId;
    let connection: GameConnection | undefined;
    let isCancelled = false;

    void connectToGame();

    return () => {
      isCancelled = true;
      connection?.leave(selectedGameId);
      connection?.disconnect();
    };

    async function connectToGame(): Promise<void> {
      const createdConnection = await createSelectedGameConnection({
        onError() {},
        onEvents(message) {
          if (message.gameId === selectedGameId) {
            gameSessionStore.getState().applyEvents(message.events);
          }
        },
        onSnapshot(message) {
          if (message.gameId === selectedGameId) {
            gameSessionStore.getState().hydrate(message.view);
          }
        },
      });

      if (isCancelled) {
        createdConnection.disconnect();
        return;
      }

      connection = createdConnection;
      connection.connect();
      connection.join(selectedGameId);
    }
  }, [gameId, gameSessionStore]);

  return (
    <PlaceholderPage
      description={`Игровая сессия ${gameId ?? 'не выбрана'}: ${synchronizationStatus}.`}
      title="Игра"
    />
  );
}
