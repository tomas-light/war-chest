import type { GameView } from '@war-chest/game-engine';
import type { ReactNode } from 'react';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { useLeaveGameMutation } from '../api/useLeaveGameMutation';
import classes from './LeaveGameButton.module.scss';

interface Props {
  gameId: string;
  isCreator: boolean;
  onLeaving(this: void): void;
  onLeaveFailed(this: void): void;
  onLeft(this: void): void;
  renderTrigger?(this: void, props: TriggerProps): ReactNode;
  view: GameView;
}

interface TriggerProps {
  disabled: boolean;
  label: string;
  onClick(this: void): void;
}

export function LeaveGameButton(props: Props) {
  const {
    gameId,
    isCreator,
    onLeaving,
    onLeaveFailed,
    onLeft,
    renderTrigger,
    view,
  } = props;

  const { t } = useTranslation('features/leave-game', {
    keyPrefix: 'LeaveGameButton',
  });

  const {
    error: leaveError,
    isPending: isLeaving,
    mutate: leaveGame,
  } = useLeaveGameMutation({
    gameId,
    onLeaving,
    onLeaveFailed,
    onLeft,
    view,
  });

  return (
    <div className={classes.action}>
      {renderButton()}

      {leaveError && <p role="alert">{leaveError}</p>}
    </div>
  );

  function renderButton(): ReactNode {
    const label = isLeaving
      ? t(isCreator ? 'closing' : 'leaving')
      : t(isCreator ? 'close' : 'leave');

    const triggerProps: TriggerProps = {
      disabled: isLeaving,
      label,
      onClick: () => leaveGame(),
    };

    if (renderTrigger !== undefined) {
      return renderTrigger(triggerProps);
    }

    return (
      <Button
        disabled={triggerProps.disabled}
        onClick={triggerProps.onClick}
        variant="secondary"
      >
        {triggerProps.label}
      </Button>
    );
  }
}
