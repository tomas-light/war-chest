import type { GameView, UnitId } from '@war-chest/game-engine';
import { Suspense } from 'react';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { useConfirmCardChoiceMutation } from '../api/useConfirmCardChoiceMutation';
import draftBanIcon from '../assets/draftBanIcon.svg';
import classes from './ConfirmCardChoiceButton.module.scss';

interface Props {
  disabled: boolean;
  gameId: string;
  onConfirmed(this: void, view: GameView): void;
  unitId: UnitId | null;
  view: GameView;
}

export function ConfirmCardChoiceButton(props: Props) {
  return (
    <Suspense fallback={null}>
      <ConfirmCardChoiceButtonContent {...props} />
    </Suspense>
  );
}

function ConfirmCardChoiceButtonContent(props: Props) {
  const { disabled, gameId, onConfirmed, unitId, view } = props;

  const { t } = useTranslation('features/confirm-card-choice', {
    keyPrefix: 'ConfirmCardChoiceButton',
  });

  const {
    error,
    isPending,
    mutate: confirm,
  } = useConfirmCardChoiceMutation({
    gameId,
    onConfirmed,
    unitId,
    view,
  });

  const isBanning = view.cardSelection?.phase === 'banning';
  const action = isBanning ? 'ban' : 'pick';

  return (
    <div className={classes.action}>
      <button
        aria-label={getButtonLabel()}
        className={classes.button}
        data-action={action}
        disabled={disabled || isPending}
        onClick={() => confirm()}
        title={getButtonLabel()}
        type="button"
      >
        {isBanning ? (
          <img alt="" src={draftBanIcon} />
        ) : (
          <span aria-hidden="true">✓</span>
        )}
      </button>
      {error && (
        <p className={classes.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );

  function getButtonLabel(): string {
    if (isPending) {
      return t('pending');
    }

    if (unitId === null) {
      if (isBanning) {
        return t('selectBan');
      }

      return t('selectCard');
    }

    if (isBanning) {
      return t('confirmBan');
    }

    return t('confirmPick');
  }
}
