import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView, UnitId } from '@war-chest/game-engine';
import { setCachedGame } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  gameId: string;
  onConfirmed(this: void, view: GameView): void;
  unitId: UnitId | null;
  view: GameView;
}

export function useConfirmCardChoiceMutation(options: Options) {
  const { gameId, onConfirmed, unitId, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (unitId === null) {
        throw new Error('A unit must be selected before confirmation.');
      }

      const gameApi = await createSelectedGameApi();

      return gameApi.confirmCardChoice(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
        unitId,
      });
    },
    onSuccess(game) {
      onConfirmed(game.view);
      setCachedGame(queryClient, game);
    },
  });

  return useTranslatedApiResult(mutation);
}
