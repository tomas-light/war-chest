import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameFormat } from '@war-chest/game-engine';
import { useState } from 'react';
import { GameSetupOption, LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import { createSelectedGameApi, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './CreateGameForm.module.scss';

interface Props {
  onCreated(this: void, gameId: string): void;
}

export function CreateGameForm(props: Props) {
  const { onCreated } = props;
  const { t } = useTranslation('features/create-game', {
    keyPrefix: 'CreateGameForm',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<GameFormat>('duel');
  const createGameMutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.createGame({
        commandId: crypto.randomUUID(),
        format,
      });
    },
    onSuccess: async (game) => {
      await queryClient.invalidateQueries({
        queryKey: LOBBY_GAMES_QUERY_KEY,
      });
      onCreated(game.gameId);
    },
  });

  return (
    <form
      aria-busy={createGameMutation.isPending}
      className={classes.form}
      onSubmit={(event) => {
        event.preventDefault();
        createGameMutation.mutate();
      }}
    >
      <fieldset className={classes.group}>
        <legend>{t('format.legend')}</legend>
        <div className={classes.optionGrid}>
          <GameSetupOption
            description={t('format.duel.description')}
            isSelected={format === 'duel'}
            label={t('format.duel.title')}
            name="game-format"
            onSelect={() => setFormat('duel')}
            stateLabel={format === 'duel' ? t('selected') : t('select')}
          />
          <GameSetupOption
            description={t('format.team.description')}
            isSelected={format === 'team'}
            label={t('format.team.title')}
            name="game-format"
            onSelect={() => setFormat('team')}
            stateLabel={format === 'team' ? t('selected') : t('select')}
          />
        </div>
      </fieldset>

      <p className={classes.description}>{t('description')}</p>

      {createGameMutation.error === null ? null : (
        <p className={classes.error} role="alert">
          {getApiErrorMessage(createGameMutation.error)}
        </p>
      )}

      <Button disabled={createGameMutation.isPending} type="submit">
        {createGameMutation.isPending ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
