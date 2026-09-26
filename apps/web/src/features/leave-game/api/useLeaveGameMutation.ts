import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { invalidateLobbyGames, removeCachedGame } from '#/entities/game';
import {
  ApiClientError,
  createSelectedGameApi,
  useTranslatedApiResult,
} from '#/shared/api';

interface Options {
  gameId: string;
  onLeaving(this: void): void;
  onLeaveFailed(this: void): void;
  onLeft(this: void): void;
  view: GameView;
}

export function useLeaveGameMutation(options: Options) {
  const { gameId, onLeaving, onLeaveFailed, onLeft, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: leaveGame,
    onError: onLeaveFailed,
    onMutate: onLeaving,
    onSuccess: async () => {
      removeCachedGame(queryClient, gameId);
      await invalidateLobbyGames(queryClient);
      onLeft();
    },
  });

  return useTranslatedApiResult(mutation);

  async function leaveGame(): Promise<void> {
    const gameApi = await createSelectedGameApi();

    try {
      await gameApi.leaveGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    } catch (error: unknown) {
      if (
        !(error instanceof ApiClientError) ||
        error.code !== 'game_version_conflict'
      ) {
        throw error;
      }

      const currentGame = await gameApi.getGame(gameId);
      await gameApi.leaveGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: currentGame.view.lastEventSequence,
      });
    }
  }
}
