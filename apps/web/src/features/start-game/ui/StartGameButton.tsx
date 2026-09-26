import type { GameView } from '@war-chest/game-engine';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { useStartGameMutation } from '../api/useStartGameMutation';
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

  const {
    error: startError,
    isPending: isStarting,
    mutate: startGame,
  } = useStartGameMutation({ gameId, onStarted, view });

  return (
    <div className={classes.action}>
      <Button disabled={isStarting} onClick={() => startGame()}>
        {isStarting ? t('starting') : t('start')}
      </Button>

      {startError && <p role="alert">{startError}</p>}
    </div>
  );
}
