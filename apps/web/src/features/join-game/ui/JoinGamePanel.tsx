import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GameView } from '@war-chest/game-engine';
import { useState } from 'react';
import {
  type GameTeam,
  GameSeatSelector,
  getGameQueryKey,
  LOBBY_GAMES_QUERY_KEY,
} from '#/entities/game';
import { createSelectedGameApi } from '#/shared/api';
import { Button } from '#/shared/ui/button';
import classes from './JoinGamePanel.module.scss';

interface Props {
  gameId: string;
  onJoined(this: void, view: GameView): void;
  userId: string;
  view: GameView;
}

export function JoinGamePanel(props: Props) {
  const { gameId, onJoined, userId, view } = props;
  const queryClient = useQueryClient();
  const occupiedTeams = view.players.map((player) => player.team);
  const currentPlayer = view.players.find((player) => player.id === userId);
  const isChangingPosition = currentPlayer !== undefined;
  const firstAvailableTeam = getFirstAvailableTeam(occupiedTeams);
  const [selectedTeam, setSelectedTeam] = useState<GameTeam | null>(
    firstAvailableTeam
  );
  const joinGameMutation = useMutation({
    mutationFn: async (team: GameTeam) => {
      const gameApi = await createSelectedGameApi({ userId });

      return gameApi.joinGame(gameId, {
        commandId: crypto.randomUUID(),
        expectedVersion: view.lastEventSequence,
        seat: 1,
        team,
      });
    },
    onSuccess: async (game) => {
      setSelectedTeam(
        getFirstAvailableTeam(game.view.players.map((player) => player.team))
      );
      onJoined(game.view);
      queryClient.setQueryData(getGameQueryKey(gameId), game);
      await queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
    },
  });

  return (
    <section className={classes.panel}>
      <h2>{isChangingPosition ? 'Сменить место' : 'Занять место'}</h2>
      <p>
        {isChangingPosition
          ? 'Пока второе место свободно, вы можете перейти на другую сторону.'
          : 'Игра ещё не началась. Выберите свободную сторону.'}
      </p>
      <GameSeatSelector
        disabled={joinGameMutation.isPending}
        occupiedTeams={occupiedTeams}
        onSelect={setSelectedTeam}
        selectedTeam={selectedTeam}
      />
      {joinGameMutation.error === null ? null : (
        <p className={classes.error} role="alert">
          {joinGameMutation.error.message}
        </p>
      )}
      <Button
        disabled={selectedTeam === null || joinGameMutation.isPending}
        onClick={joinSelectedTeam}
      >
        {getActionLabel(isChangingPosition, joinGameMutation.isPending)}
      </Button>
    </section>
  );

  function joinSelectedTeam(): void {
    if (selectedTeam !== null) {
      joinGameMutation.mutate(selectedTeam);
    }
  }
}

function getActionLabel(
  isChangingPosition: boolean,
  isPending: boolean
): string {
  if (isPending) {
    return isChangingPosition ? 'Меняем место…' : 'Подключаем…';
  }

  return isChangingPosition ? 'Сменить место' : 'Присоединиться как игрок';
}

function getFirstAvailableTeam(
  occupiedTeams: readonly GameTeam[]
): GameTeam | null {
  if (!occupiedTeams.includes('white')) {
    return 'white';
  }

  return occupiedTeams.includes('black') ? null : 'black';
}
