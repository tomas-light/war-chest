import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { setCachedGame } from '#/entities/game';
import {
  ApiClientError,
  createSelectedGameApi,
  useTranslatedApiResult,
} from '#/shared/api';

interface Options {
  gameId: string;
  onCompleted(this: void, view: GameView): void;
}

export function useCompleteCardSelectionMutation(options: Options) {
  const { gameId, onCompleted } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();
      const game = await gameApi.getGame(gameId);

      if (game.view.status !== 'cardSelection') {
        return game;
      }

      try {
        return await gameApi.completeCardSelection(gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
        });
      } catch (error: unknown) {
        if (
          error instanceof ApiClientError &&
          error.code === 'game_version_conflict'
        ) {
          const latestGame = await gameApi.getGame(gameId);
          if (latestGame.view.status !== 'cardSelection') {
            return latestGame;
          }
        }

        throw error;
      }
    },
    onSuccess(game) {
      onCompleted(game.view);
      setCachedGame(queryClient, game);
    },
  });

  return useTranslatedApiResult(mutation);
}
