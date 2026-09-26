import type { GameView } from '@war-chest/game-engine';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { useSurrenderGameMutation } from '../api/useSurrenderGameMutation';
import classes from './SurrenderGameButton.module.scss';

interface Props {
  gameId: string;
  onSurrendered(this: void, view: GameView): void;
  renderTrigger?(this: void, props: TriggerProps): ReactNode;
  view: GameView;
}

interface TriggerProps {
  disabled: boolean;
  label: string;
  onClick(this: void): void;
}

export function SurrenderGameButton(props: Props) {
  const { gameId, onSurrendered, renderTrigger, view } = props;

  const { t } = useTranslation('features/surrender-game', {
    keyPrefix: 'SurrenderGameButton',
  });

  const {
    error: surrenderError,
    isPending: isSurrendering,
    mutate: surrenderGame,
  } = useSurrenderGameMutation({
    gameId,
    onSurrendered,
    view,
  });

  return (
    <div
      className={clsx(classes.action, {
        [classes.headerAction]: renderTrigger !== undefined,
      })}
    >
      {renderButton()}

      {surrenderError && <p role="alert">{surrenderError}</p>}
    </div>
  );

  function renderButton(): ReactNode {
    const label = isSurrendering ? t('surrendering') : t('surrender');
    const triggerProps: TriggerProps = {
      disabled: isSurrendering,
      label,
      onClick: () => surrenderGame(),
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
