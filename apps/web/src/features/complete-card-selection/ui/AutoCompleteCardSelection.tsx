import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { useEffect, useRef } from 'react';
import { getGameQueryKey } from '#/entities/game';
import {
  ApiClientError,
  createSelectedGameApi,
  useApiErrorMessage,
} from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
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

  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const attemptedVersion = useRef<number | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      const game = await gameApi.getGame(gameId);

      if (game.view.status !== 'cardSelection') {
        return game;
      }

      try {
        return await gameApi.completeCardSelection(gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
        });
      } catch (error: unknown) {
        if (
          error instanceof ApiClientError &&
          error.code === 'game_version_conflict'
        ) {
          const latestGame = await gameApi.getGame(gameId);
          if (latestGame.view.status !== 'cardSelection') {
            return latestGame;
          }
        }

        throw error;
      }
    },
    onSuccess(game) {
      onCompleted(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
    },
  });

  const { mutate } = mutation;

  useEffect(() => {
    if (disabled || attemptedVersion.current === view.lastEventSequence) {
      return;
    }

    attemptedVersion.current = view.lastEventSequence;
    mutate();
  }, [disabled, mutate, view.lastEventSequence]);

  return (
    <div className={classes.action}>
      {mutation.error === null ? (
        <LoadingIndicator label={t('pending')} />
      ) : (
        <>
          <p role="alert">{getApiErrorMessage(mutation.error)}</p>
          <Button
            disabled={disabled || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {t('retry')}
          </Button>
        </>
      )}
    </div>
  );
}
