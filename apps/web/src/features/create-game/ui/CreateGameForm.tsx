import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent } from 'react';
import { LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
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
  const createGameMutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi();

      return gameApi.createGame({
        commandId: crypto.randomUUID(),
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
      onSubmit={handleSubmit}
    >
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

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    createGameMutation.mutate();
  }
}
