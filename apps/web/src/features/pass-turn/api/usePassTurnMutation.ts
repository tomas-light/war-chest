import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { setCachedGame } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  coinIndex: number | null;
  gameId: string;
  onPassed(this: void, view: GameView): void;
  view: GameView;
}

export function usePassTurnMutation(options: Options) {
  const { coinIndex, gameId, onPassed, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (coinIndex === null) {
        throw new Error('A coin must be selected before passing.');
      }

      const gameApi = await createSelectedGameApi();

      return gameApi.passTurn(gameId, {
        coinIndex,
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess(game) {
      onPassed(game.view);
      setCachedGame(queryClient, game);
    },
  });

  return useTranslatedApiResult(mutation);
}
