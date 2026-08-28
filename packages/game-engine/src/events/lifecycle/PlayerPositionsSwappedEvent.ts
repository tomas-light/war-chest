import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { PlayerPositionsSwappedEventData } from '../../events.js';
import type { GameState, GameTeams } from '../../state.js';
import type { PlayerPositionsSwappedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class PlayerPositionsSwappedEvent implements ApplicableEvent<PlayerPositionsSwappedEventData> {
  private constructor(readonly data: PlayerPositionsSwappedEventData) {}

  static fromData(
    data: PlayerPositionsSwappedEventData
  ): PlayerPositionsSwappedEvent {
    const [firstPosition, secondPosition] = data.payload.positions;

    return new PlayerPositionsSwappedEvent({
      ...data,
      payload: {
        positions: [{ ...firstPosition }, { ...secondPosition }],
      },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    const nextPlayers = applyPositions(state, this.data);

    return {
      ...state,
      lastEventSequence: this.data.sequence,
      players: nextPlayers,
      teams: createTeams(nextPlayers),
    };
  }

  toData(): PlayerPositionsSwappedEventData {
    const [firstPosition, secondPosition] = this.data.payload.positions;

    return {
      ...this.data,
      payload: {
        positions: [{ ...firstPosition }, { ...secondPosition }],
      },
    };
  }

  toViewData(): PlayerPositionsSwappedViewEventData {
    return this.toData();
  }
}

function applyPositions(
  state: GameState,
  event: PlayerPositionsSwappedEventData
): GameState['players'] {
  const positionsByPlayerId = new Map(
    event.payload.positions.map((position) => [position.playerId, position])
  );

  if (
    positionsByPlayerId.size !== event.payload.positions.length ||
    event.payload.positions.some(
      (position) =>
        !state.players.some((player) => player.id === position.playerId)
    )
  ) {
    throw new Error('Swapped positions must reference two joined players.');
  }

  return state.players.map((player) => {
    const position = positionsByPlayerId.get(player.id);

    return position === undefined
      ? player
      : { ...player, seat: position.seat, team: position.team };
  });
}

function createTeams(players: GameState['players']): GameTeams {
  return {
    black: players
      .filter((player) => player.team === 'black')
      .map((player) => player.id),
    white: players
      .filter((player) => player.team === 'white')
      .map((player) => player.id),
  };
}
