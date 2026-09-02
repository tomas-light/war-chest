import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { getGameQueryKey, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './StartGameButton.module.scss';

interface Props {
  gameId: string;
  onStarted(this: void, view: GameView): void;
  view: GameView;
}

export function StartGameButton(props: Props) {
  const { gameId, onStarted, view } = props;

  const { t } = useTranslation('features/start-game', {
    keyPrefix: 'StartGameButton',
  });

  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const startGameMutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.startGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    },
    onSuccess: async (game) => {
      onStarted(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      await queryClient.invalidateQueries({
        queryKey: LOBBY_GAMES_QUERY_KEY,
      });
    },
  });

  return (
    <div className={classes.action}>
      <Button
        disabled={startGameMutation.isPending}
        onClick={() => startGameMutation.mutate()}
      >
        {startGameMutation.isPending ? t('starting') : t('start')}
      </Button>

      {startGameMutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(startGameMutation.error)}</p>
      )}
    </div>
  );
}
