import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CardSelectionMode,
  GameExpansion,
  GameView,
} from '@war-chest/game-engine';
import { setCachedGame } from '#/entities/game';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Settings {
  cardSelectionMode: CardSelectionMode;
  expansions: readonly GameExpansion[];
}

interface Options {
  gameId: string;
  onUpdated(this: void, view: GameView): void;
  view: GameView;
}

export function useUpdateGameSettingsMutation(options: Options) {
  const { gameId, onUpdated, view } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (settings: Settings) => {
      const gameApi = await createSelectedGameApi();

      return gameApi.updateGameSettings(gameId, {
        ...settings,
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess: (game) => {
      setCachedGame(queryClient, game);
      onUpdated(game.view);
    },
  });

  return useTranslatedApiResult(mutation);
}
