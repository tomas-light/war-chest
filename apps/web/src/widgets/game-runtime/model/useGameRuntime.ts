import { useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import {
  cacheGameView,
  invalidateLobbyGames,
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

export function useGameRuntimeState(input: Input) {
  const queryClient = useQueryClient();
  const {
    data: game,
    error: gameError,
    isError: isGameError,
    isPending: isGamePending,
  } = useGameQuery(input.gameId);

  const { data: lobbyGames, isPending: isLobbyPending } = useLobbyGamesQuery();

  const connectionRef = useRef<GameConnection | null>(null);
  const [connectionError, setConnectionError] = useState<ApiClientError | null>(
    null
  );

  const gameSessionStore = useMemo(() => createGameSessionStore(), []);
  const liveState = useStore(gameSessionStore, (state) => state.liveState);
  const retainedPlayerProfiles = useStore(
    gameSessionStore,
    (state) => state.playerProfiles
  );
  const synchronizationStatus = useStore(
    gameSessionStore,
    (state) => state.synchronizationStatus
  );

  const currentLobbyGame = lobbyGames?.items.find(
    (game) => game.id === input.gameId
  );
  const playerProfiles =
    currentLobbyGame?.players ?? game?.players ?? retainedPlayerProfiles;

  useEffect(() => {
    const profiles = currentLobbyGame?.players ?? game?.players;

    if (profiles !== undefined) {
      gameSessionStore.getState().retainPlayerProfiles(profiles);
    }
  }, [currentLobbyGame, game?.players, gameSessionStore]);

  useEffect(() => {
    if (game !== undefined) {
      gameSessionStore.getState().hydrate(game.view);
    }
  }, [game, gameSessionStore]);

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
      const connection = await createSelectedGameConnection({
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
              cacheGameView({
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
            cacheGameView({
              gameId: currentGameId,
              queryClient,
              view: message.view,
            });
            refreshLobby();
          }
        },
      });

      if (isCancelled) {
        connection.disconnect();
        return;
      }

      connectionRef.current = connection;
      connection.connect();
      connection.join(currentGameId);
    }

    function refreshLobby(): void {
      void invalidateLobbyGames(queryClient);
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
    currentPlayerGameId: lobbyGames?.currentPlayerGameId ?? null,
    gameError,
    hydrateGame,
    isGameError,
    isGamePending,
    isLobbyPending,
    liveState,
    playerProfiles,
    synchronizationStatus,
  };

  function hydrateGame(view: GameView): void {
    gameSessionStore.getState().hydrate(view);
    cacheGameView({
      gameId: input.gameId,
      queryClient,
      view,
    });
    void invalidateLobbyGames(queryClient);
  }
}
