import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import type { ReactNode } from 'react';
import { getGameQueryKey, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import {
  ApiClientError,
  createSelectedGameApi,
  useApiErrorMessage,
} from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
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

  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const leaveGameMutation = useMutation({
    mutationFn: leaveGame,
    onError: onLeaveFailed,
    onMutate: onLeaving,
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: getGameQueryKey(gameId) });
      await queryClient.invalidateQueries({
        queryKey: LOBBY_GAMES_QUERY_KEY,
      });
      onLeft();
    },
  });

  return (
    <div className={classes.action}>
      {renderButton()}

      {leaveGameMutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(leaveGameMutation.error)}</p>
      )}
    </div>
  );

  function renderButton(): ReactNode {
    const label = leaveGameMutation.isPending
      ? t(isCreator ? 'closing' : 'leaving')
      : t(isCreator ? 'close' : 'leave');
    const triggerProps: TriggerProps = {
      disabled: leaveGameMutation.isPending,
      label,
      onClick: () => leaveGameMutation.mutate(),
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

  async function leaveGame(): Promise<void> {
    const gameApi = await createSelectedGameApi();

    try {
      await gameApi.leaveGame(gameId, {
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
      await gameApi.leaveGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: currentGame.view.lastEventSequence,
      });
    }
  }
}
