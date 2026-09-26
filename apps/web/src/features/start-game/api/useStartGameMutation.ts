import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { invalidateLobbyGames, setCachedGame } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  gameId: string;
  onStarted(this: void, view: GameView): void;
  view: GameView;
}

export function useStartGameMutation(options: Options) {
  const { gameId, onStarted, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.startGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess: async (game) => {
      onStarted(game.view);
      setCachedGame(queryClient, game);
      await invalidateLobbyGames(queryClient);
    },
  });

  return useTranslatedApiResult(mutation);
}
