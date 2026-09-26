import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { invalidateLobbyGames, setCachedGame } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  gameId: string;
  onSwapped(this: void, view: GameView): void;
  view: GameView;
}

export function useSwapPlayerPositionsMutation(options: Options) {
  const { gameId, onSwapped, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.swapPlayerPositions(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess: async (game) => {
      onSwapped(game.view);
      setCachedGame(queryClient, game);
      await invalidateLobbyGames(queryClient);
    },
  });

  return useTranslatedApiResult(mutation);
}
