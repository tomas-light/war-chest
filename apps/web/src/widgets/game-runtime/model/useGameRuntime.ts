import { useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import {
  cacheGameView,
  invalidateLobbyGames,
  useGameConnection,
  useGameQuery,
  useLobbyGamesQuery,
} from '#/entities/game';
import { createGameSessionStore } from '#/entities/game-session';
import { type ApiClientError, createApiClientError } from '#/shared/api';
import { useGameReplay } from './useGameReplay';

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

  const [connectionError, setConnectionError] = useState<ApiClientError | null>(
    null
  );

  const gameSessionStore = useMemo(() => createGameSessionStore(), []);
  const liveState = useStore(gameSessionStore, (state) => state.liveState);
  const viewedState = useStore(gameSessionStore, (state) => state.viewedState);
  const replay = useGameReplay({
    gameId: input.gameId,
    gameSessionStore,
    userId: input.userId,
    viewedState,
  });
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

  const { synchronize } = useGameConnection({
    gameId: input.gameId,
    onError(message) {
      setConnectionError(
        createApiClientError({
          code: message.code,
          diagnosticMessage: message.message,
        })
      );
    },
    onEvents(message) {
      gameSessionStore.getState().applyEvents(message.events);
      const nextView = gameSessionStore.getState().liveState;

      if (nextView !== null) {
        cacheGameView({
          gameId: message.gameId,
          queryClient,
          view: nextView,
        });
      }

      void invalidateLobbyGames(queryClient);
    },
    onSnapshot(message) {
      setConnectionError(null);
      gameSessionStore.getState().hydrate(message.view);
      cacheGameView({
        gameId: message.gameId,
        queryClient,
        view: message.view,
      });
      void invalidateLobbyGames(queryClient);
    },
    userId: input.userId,
  });

  useEffect(() => {
    if (synchronizationStatus !== 'desynchronized' || input.gameId === '') {
      return;
    }

    const lastSequence =
      gameSessionStore.getState().liveState?.lastEventSequence ?? 0;

    synchronize(lastSequence);
  }, [gameSessionStore, input.gameId, synchronizationStatus, synchronize]);

  return {
    connectionError,
    currentPlayerGameId: lobbyGames?.currentPlayerGameId ?? null,
    gameError,
    hydrateGame,
    isGameError,
    isGamePending,
    isLobbyPending,
    liveState,
    replay,
    viewedState,
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
