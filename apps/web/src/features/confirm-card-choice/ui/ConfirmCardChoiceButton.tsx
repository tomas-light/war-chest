import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView, UnitId } from '@war-chest/game-engine';
import { getGameQueryKey } from '#/entities/game';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './ConfirmCardChoiceButton.module.scss';

interface Props {
  disabled: boolean;
  gameId: string;
  onConfirmed(this: void, view: GameView): void;
  unitId: UnitId | null;
  view: GameView;
}

export function ConfirmCardChoiceButton(props: Props) {
  const { disabled, gameId, onConfirmed, unitId, view } = props;

  const { t } = useTranslation('features/confirm-card-choice', {
    keyPrefix: 'ConfirmCardChoiceButton',
  });

  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (unitId === null) {
        throw new Error('A unit must be selected before confirmation.');
      }

      const gameApi = await createSelectedGameApi();

      return gameApi.confirmCardChoice(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
        unitId,
      });
    },
    onSuccess(game) {
      onConfirmed(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
    },
  });

  const isBanning = view.cardSelection?.phase === 'banning';

  return (
    <div className={classes.action}>
      <Button
        className={classes.button}
        disabled={disabled || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {getButtonLabel()}
      </Button>
      {mutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(mutation.error)}</p>
      )}
    </div>
  );

  function getButtonLabel(): string {
    if (mutation.isPending) {
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
