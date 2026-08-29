import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { getGameQueryKey, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import {
  ApiClientError,
  createSelectedGameApi,
  useApiErrorMessage,
} from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './SurrenderGameButton.module.scss';

interface Props {
  gameId: string;
  onSurrendered(this: void, view: GameView): void;
  userId: string;
  view: GameView;
}

export function SurrenderGameButton(props: Props) {
  const { gameId, onSurrendered, userId, view } = props;
  const { t } = useTranslation('features/surrender-game', {
    keyPrefix: 'SurrenderGameButton',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const surrenderGameMutation = useMutation({
    mutationFn: surrenderGame,
    onSuccess: async (game) => {
      onSurrendered(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      await queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
    },
  });

  return (
    <div className={classes.action}>
      <Button
        disabled={surrenderGameMutation.isPending}
        onClick={() => surrenderGameMutation.mutate()}
        variant="secondary"
      >
        {surrenderGameMutation.isPending ? t('surrendering') : t('surrender')}
      </Button>
      {surrenderGameMutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(surrenderGameMutation.error)}</p>
      )}
    </div>
  );

  async function surrenderGame() {
    const gameApi = await createSelectedGameApi({ userId });

    try {
      return await gameApi.surrenderGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
      });
    } catch (error: unknown) {
      if (
        !(error instanceof ApiClientError) ||
        error.code !== 'game_version_conflict'
      ) {
        throw error;
      }

      const currentGame = await gameApi.getGame(gameId);
      return gameApi.surrenderGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: currentGame.view.lastEventSequence,
      });
    }
  }
}
