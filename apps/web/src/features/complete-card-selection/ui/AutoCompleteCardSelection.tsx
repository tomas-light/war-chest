import type { GameView } from '@war-chest/game-engine';
import { useEffect, useRef } from 'react';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import { useCompleteCardSelectionMutation } from '../api/useCompleteCardSelectionMutation';
import classes from './AutoCompleteCardSelection.module.scss';

interface Props {
  disabled: boolean;
  gameId: string;
  onCompleted(this: void, view: GameView): void;
  view: GameView;
}

export function AutoCompleteCardSelection(props: Props) {
  const { disabled, gameId, onCompleted, view } = props;

  const { t } = useTranslation('features/complete-card-selection', {
    keyPrefix: 'AutoCompleteCardSelection',
  });

  const attemptedVersion = useRef<number | null>(null);

  const {
    mutate: completeSelection,
    error,
    isPending,
  } = useCompleteCardSelectionMutation({
    gameId,
    onCompleted,
  });

  useEffect(() => {
    if (disabled || attemptedVersion.current === view.lastEventSequence) {
      return;
    }

    attemptedVersion.current = view.lastEventSequence;
    completeSelection();
  }, [disabled, completeSelection, view.lastEventSequence]);

  return (
    <div className={classes.action}>
      {error === null ? (
        <LoadingIndicator label={t('pending')} />
      ) : (
        <>
          <p role="alert">{error}</p>
          <Button
            disabled={disabled || isPending}
            onClick={() => completeSelection()}
          >
            {t('retry')}
          </Button>
        </>
      )}
    </div>
  );
}
