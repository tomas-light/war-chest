import type { GameView } from '@war-chest/game-engine';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { useJoinGameMutation } from '../api/useJoinGameMutation';
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
  const {
    error: joinError,
    isPending: isJoining,
    mutate: joinGame,
  } = useJoinGameMutation({
    gameId,
    onJoined,
    seat,
    team,
    view,
  });

  return (
    <span className={classes.wrapper}>
      <Button
        aria-label={t('label', { seat })}
        className={classes.button}
        disabled={disabled || isJoining}
        onClick={() => joinGame()}
        title={t('label', { seat })}
        variant="secondary"
      >
        <img alt="" className={classes.icon} src={SEAT_ACTION_JOIN} />
      </Button>

      {joinError && (
        <span className={classes.error} role="alert">
          {joinError}
        </span>
      )}
    </span>
  );
}
