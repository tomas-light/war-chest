import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { getGameQueryKey, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import SEAT_ACTION_JOIN from '../assets/seatActionJoin.svg';
import classes from './JoinGameButton.module.scss';

interface Props {
  disabled?: boolean;
  gameId: string;
  onJoined(this: void, view: GameView): void;
  seat: number;
  team: 'black' | 'white';
  view: GameView;
}

export function JoinGameButton(props: Props) {
  const { disabled = false, gameId, onJoined, seat, team, view } = props;
  const { t } = useTranslation('features/join-game', {
    keyPrefix: 'JoinGameButton',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const joinMutation = useMutation({
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
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      onJoined(game.view);
      await queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
    },
  });

  return (
    <span className={classes.wrapper}>
      <Button
        aria-label={t('label', { seat })}
        className={classes.button}
        disabled={disabled || joinMutation.isPending}
        onClick={() => joinMutation.mutate()}
        title={t('label', { seat })}
        variant="secondary"
      >
        <img alt="" className={classes.icon} src={SEAT_ACTION_JOIN} />
      </Button>
      {joinMutation.error === null ? null : (
        <span className={classes.error} role="alert">
          {getApiErrorMessage(joinMutation.error)}
        </span>
      )}
    </span>
  );
}
