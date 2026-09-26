import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameFormat } from '@war-chest/game-engine';
import { invalidateLobbyGames } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  format: GameFormat;
  onCreated(this: void, gameId: string): void;
}

export function useCreateGameMutation(options: Options) {
  const { format, onCreated } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.createGame({ commandId: crypto.randomUUID(), format });
    },
    onSuccess: async (game) => {
      await invalidateLobbyGames(queryClient);
      onCreated(game.gameId);
    },
  });

  return useTranslatedApiResult(mutation);
}
