import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { getGameQueryKey, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import {
  ApiClientError,
  createSelectedGameApi,
  useApiErrorMessage,
} from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
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

  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();

  const surrenderGameMutation = useMutation({
    mutationFn: surrenderGame,
    onSuccess: async (game) => {
      onSurrendered(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      await queryClient.invalidateQueries({
        queryKey: LOBBY_GAMES_QUERY_KEY,
      });
    },
  });

  return (
    <div
      className={clsx(classes.action, {
        [classes.headerAction]: renderTrigger !== undefined,
      })}
    >
      {renderButton()}

      {surrenderGameMutation.error === null ? null : (
        <p role="alert">{getApiErrorMessage(surrenderGameMutation.error)}</p>
      )}
    </div>
  );

  function renderButton(): ReactNode {
    const label = surrenderGameMutation.isPending
      ? t('surrendering')
      : t('surrender');
    const triggerProps: TriggerProps = {
      disabled: surrenderGameMutation.isPending,
      label,
      onClick: () => surrenderGameMutation.mutate(),
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

  async function surrenderGame() {
    const gameApi = await createSelectedGameApi();

    try {
      return await gameApi.surrenderGame(gameId, {
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
      return gameApi.surrenderGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: currentGame.view.lastEventSequence,
      });
    }
  }
}
