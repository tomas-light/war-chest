import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { getGameQueryKey, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './SwapPlayerPositionsButton.module.scss';

interface Props {
  gameId: string;
  onSwapped(this: void, view: GameView): void;
  userId: string;
  view: GameView;
}

export function SwapPlayerPositionsButton(props: Props) {
  const { gameId, onSwapped, userId, view } = props;
  const { t } = useTranslation('features/swap-player-positions', {
    keyPrefix: 'SwapPlayerPositionsButton',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const swapMutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi({ userId });

      return gameApi.swapPlayerPositions(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess: async (game) => {
      onSwapped(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      await queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
    },
  });

  return (
    <div className={classes.action}>
      <Button
        aria-label={t('label')}
        className={classes.button}
        disabled={swapMutation.isPending}
        onClick={() => swapMutation.mutate()}
        title={t('label')}
        variant="secondary"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M7 7h11l-3-3M17 17H6l3 3M18 7l-3 3M6 17l3-3" />
        </svg>
      </Button>
      {swapMutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(swapMutation.error)}</p>
      )}
    </div>
  );
}
