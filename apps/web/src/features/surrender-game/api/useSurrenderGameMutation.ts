import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { invalidateLobbyGames, setCachedGame } from '#/entities/game';
import {
  ApiClientError,
  createSelectedGameApi,
  useTranslatedApiResult,
} from '#/shared/api';

interface Options {
  gameId: string;
  onSurrendered(this: void, view: GameView): void;
  view: GameView;
}

export function useSurrenderGameMutation(options: Options) {
  const { gameId, onSurrendered, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: surrenderGame,
    onSuccess: async (game) => {
      onSurrendered(game.view);
      setCachedGame(queryClient, game);
      await invalidateLobbyGames(queryClient);
    },
  });

  return useTranslatedApiResult(mutation);

  async function surrenderGame() {
    const gameApi = await createSelectedGameApi();

    try {
      return await gameApi.surrenderGame(gameId, {
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
      return gameApi.surrenderGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: currentGame.view.lastEventSequence,
      });
    }
  }
}
