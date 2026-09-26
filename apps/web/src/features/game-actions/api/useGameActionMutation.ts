import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { setCachedGame } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  coinIndex: number;
  gameId: string;
  onClose(this: void): void;
  onPassed(this: void, view: GameView): void;
  view: GameView;
}

export function useGameActionMutation(options: Options) {
  const { coinIndex, gameId, onClose, onPassed, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
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
      onClose();
    },
  });

  return useTranslatedApiResult(mutation);
}
