import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  getGameQueryKey,
  LOBBY_GAMES_QUERY_KEY,
  useGameQuery,
  useLobbyGamesQuery,
} from '#/entities/game';
import { createGameSessionStore } from '#/entities/game-session';
import {
  type ApiClientError,
  type GameConnection,
  createApiClientError,
  createSelectedGameConnection,
} from '#/shared/api';

interface Input {
  gameId: string;
  userId: string;
}

interface CacheGameInput {
  gameId: string;
  queryClient: QueryClient;
  view: GameView;
}

export function useGameRuntimeState(input: Input) {
  const queryClient = useQueryClient();
  const gameQuery = useGameQuery(input.gameId, input.userId);
  const lobbyGamesQuery = useLobbyGamesQuery(input.userId);
  const gameSessionStore = useMemo(() => createGameSessionStore(), []);
  const connectionRef = useRef<GameConnection | null>(null);
  const liveState = useStore(gameSessionStore, (state) => state.liveState);
  const synchronizationStatus = useStore(
    gameSessionStore,
    (state) => state.synchronizationStatus
  );
  const [connectionError, setConnectionError] = useState<ApiClientError | null>(
    null
  );
  const lobbyGame = lobbyGamesQuery.data?.items.find(
    (game) => game.id === input.gameId
  );

  useEffect(() => {
    if (gameQuery.data !== undefined) {
      gameSessionStore.getState().hydrate(gameQuery.data.view);
    }
  }, [gameQuery.data, gameSessionStore]);

  useEffect(() => {
    if (input.gameId === '' || input.userId === '') {
      return;
    }

    const currentGameId = input.gameId;
    let isCancelled = false;

    void connectToGame();

    return () => {
      isCancelled = true;
      connectionRef.current?.leave(currentGameId);
      connectionRef.current?.disconnect();
      connectionRef.current = null;
    };

    async function connectToGame(): Promise<void> {
      const connection = await createSelectedGameConnection(
        {
          onError(message) {
            setConnectionError(
              createApiClientError({
                code: message.code,
                diagnosticMessage: message.message,
              })
            );
          },
          onEvents(message) {
            if (message.gameId === currentGameId) {
              gameSessionStore.getState().applyEvents(message.events);
              const nextView = gameSessionStore.getState().liveState;

              if (nextView !== null) {
                cacheGame({
                  gameId: currentGameId,
                  queryClient,
                  view: nextView,
                });
              }

              refreshLobby();
            }
          },
          onSnapshot(message) {
            if (message.gameId === currentGameId) {
              setConnectionError(null);
              gameSessionStore.getState().hydrate(message.view);
              cacheGame({
                gameId: currentGameId,
                queryClient,
                view: message.view,
              });
              refreshLobby();
            }
          },
        },
        input.userId
      );

      if (isCancelled) {
        connection.disconnect();
        return;
      }

      connectionRef.current = connection;
      connection.connect();
      connection.join(currentGameId);
    }

    function refreshLobby(): void {
      void queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
    }
  }, [gameSessionStore, input.gameId, input.userId, queryClient]);

  useEffect(() => {
    if (synchronizationStatus !== 'desynchronized' || input.gameId === '') {
      return;
    }

    const lastSequence =
      gameSessionStore.getState().liveState?.lastEventSequence ?? 0;

    connectionRef.current?.synchronize(input.gameId, lastSequence);
  }, [gameSessionStore, input.gameId, synchronizationStatus]);

  return {
    connectionError,
    currentPlayerGameId: lobbyGamesQuery.data?.currentPlayerGameId ?? null,
    gameQuery,
    hydrateGame,
    isLobbyPending: lobbyGamesQuery.isPending,
    liveState,
    lobbyGame,
    synchronizationStatus,
  };

  function hydrateGame(view: GameView): void {
    gameSessionStore.getState().hydrate(view);
    cacheGame({ gameId: input.gameId, queryClient, view });
    void queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
  }
}

function cacheGame(input: CacheGameInput): void {
  if (input.gameId === '') {
    return;
  }

  input.queryClient.setQueryData(getGameQueryKey(input.gameId), {
    gameId: input.gameId,
    view: input.view,
  });
}
