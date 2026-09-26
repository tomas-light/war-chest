import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { invalidateLobbyGames, setCachedGame } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  gameId: string;
  onJoined(this: void, view: GameView): void;
  seat: number;
  team: 'black' | 'white';
  view: GameView;
}

export function useJoinGameMutation(options: Options) {
  const { gameId, onJoined, seat, team, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.joinGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
        seat,
        team,
      });
    },
    onSuccess: async (game) => {
      setCachedGame(queryClient, game);
      onJoined(game.view);
      await invalidateLobbyGames(queryClient);
    },
  });

  return useTranslatedApiResult(mutation);
}
