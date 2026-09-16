import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { getGameQueryKey, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { SwapPositionsButton } from '#/shared/ui/swap-positions-button';
import classes from './SwapPlayerPositionsButton.module.scss';

interface Props {
  gameId: string;
  onSwapped(this: void, view: GameView): void;
  view: GameView;
}

export function SwapPlayerPositionsButton(props: Props) {
  const { gameId, onSwapped, view } = props;

  const { t } = useTranslation('features/swap-player-positions', {
    keyPrefix: 'SwapPlayerPositionsButton',
  });

  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const swapMutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.swapPlayerPositions(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess: async (game) => {
      onSwapped(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      await queryClient.invalidateQueries({
        queryKey: LOBBY_GAMES_QUERY_KEY,
      });
    },
  });

  return (
    <div className={classes.action}>
      <SwapPositionsButton
        aria-label={t('label')}
        disabled={swapMutation.isPending}
        onClick={() => swapMutation.mutate()}
        title={t('label')}
      />

      {swapMutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(swapMutation.error)}</p>
      )}
    </div>
  );
}
