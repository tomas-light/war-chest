import { useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { useEffect, useMemo, useState } from 'react';
import { getGameEventsQueryOptions } from '#/entities/game';
import type { GameSessionStore } from '#/entities/game-session';
import {
  type ReplayStatus,
  createGameReplayController,
} from './createGameReplayController';

interface Options {
  gameId: string;
  gameSessionStore: GameSessionStore;
  userId: string;
  viewedState: GameView | null;
}

const REPLAY_STEP_DELAY_MS = 1000;

export function useGameReplay(options: Options) {
  const { gameId, gameSessionStore, userId, viewedState } = options;

  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReplayStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const controller = useMemo(
    () =>
      createGameReplayController({
        gameSessionStore,
        async loadEvents(eventSequence) {
          const history = await queryClient.fetchQuery(
            getGameEventsQueryOptions({ eventSequence, gameId, userId })
          );
          return history.events;
        },
        onStatusChange(status, error) {
          if (status === 'error') {
            void queryClient.invalidateQueries({
              queryKey: ['game-events', gameId, userId],
              refetchType: 'none',
            });
          }

          setStatus(status);
          setError(error);
        },
      }),
    [gameId, gameSessionStore, queryClient, userId]
  );

  useEffect(() => controller.cancelPendingOperation, [controller]);

  useEffect(() => {
    if (status !== 'playing') {
      return;
    }

    const timer = window.setTimeout(() => {
      void controller.advanceReplay();
    }, REPLAY_STEP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [controller, status, viewedState]);

  return {
    error,
    pauseReplay: controller.pauseReplay,
    playReplay: controller.playReplay,
    returnToLive: controller.returnToLive,
    retryReplay: controller.retryReplay,
    status,
    viewHistory: controller.viewHistory,
  };
}
