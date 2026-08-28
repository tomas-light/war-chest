import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameTeams, GameView } from '../../state.js';
import type { PlayerPositionsSwappedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class PlayerPositionsSwappedViewEvent implements ApplicableViewEvent<PlayerPositionsSwappedViewEventData> {
  private constructor(readonly data: PlayerPositionsSwappedViewEventData) {}

  static fromData(
    data: PlayerPositionsSwappedViewEventData
  ): PlayerPositionsSwappedViewEvent {
    const [firstPosition, secondPosition] = data.payload.positions;

    return new PlayerPositionsSwappedViewEvent({
      ...data,
      payload: {
        positions: [{ ...firstPosition }, { ...secondPosition }],
      },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    const nextPlayers = applyPositions(view, this.data);

    return {
      ...view,
      lastEventSequence: this.data.sequence,
      players: nextPlayers,
      teams: createTeams(nextPlayers),
    };
  }

  toData(): PlayerPositionsSwappedViewEventData {
    const [firstPosition, secondPosition] = this.data.payload.positions;

    return {
      ...this.data,
      payload: {
        positions: [{ ...firstPosition }, { ...secondPosition }],
      },
    };
  }
}

function applyPositions(
  view: GameView,
  event: PlayerPositionsSwappedViewEventData
): GameView['players'] {
  const positionsByPlayerId = new Map(
    event.payload.positions.map((position) => [position.playerId, position])
  );

  if (
    positionsByPlayerId.size !== event.payload.positions.length ||
    event.payload.positions.some(
      (position) =>
        !view.players.some((player) => player.id === position.playerId)
    )
  ) {
    throw new Error('Swapped positions must reference two joined players.');
  }

  return view.players.map((player) => {
    const position = positionsByPlayerId.get(player.id);

    return position === undefined
      ? player
      : { ...player, seat: position.seat, team: position.team };
  });
}

function createTeams(players: GameView['players']): GameTeams {
  return {
    black: players
      .filter((player) => player.team === 'black')
      .map((player) => player.id),
    white: players
      .filter((player) => player.team === 'white')
      .map((player) => player.id),
  };
}
