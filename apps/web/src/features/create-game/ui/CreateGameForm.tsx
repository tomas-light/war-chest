import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent } from 'react';
import { LOBBY_GAMES_QUERY_KEY } from '#/entities/game';
import { createSelectedGameApi } from '#/shared/api';
import { Button } from '#/shared/ui/button';
import classes from './CreateGameForm.module.scss';

interface Props {
  onCreated(this: void, gameId: string): void;
  userId: string;
}

export function CreateGameForm(props: Props) {
  const { onCreated, userId } = props;
  const queryClient = useQueryClient();
  const createGameMutation = useMutation({
    mutationFn: async () => {
      const gameApi = await createSelectedGameApi({ userId });

      return gameApi.createGame({
        commandId: crypto.randomUUID(),
      });
    },
    onSuccess: async (game) => {
      await queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
      onCreated(game.gameId);
    },
  });

  return (
    <form
      aria-busy={createGameMutation.isPending}
      className={classes.form}
      onSubmit={handleSubmit}
    >
      <p className={classes.description}>
        Игра появится в лобби без занятых мест. Вы сможете выбрать сторону на
        следующем экране.
      </p>
      {createGameMutation.error === null ? null : (
        <p className={classes.error} role="alert">
          {createGameMutation.error.message}
        </p>
      )}
      <Button disabled={createGameMutation.isPending} type="submit">
        {createGameMutation.isPending ? 'Создаём игру…' : 'Создать игру'}
      </Button>
    </form>
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    createGameMutation.mutate();
  }
}
