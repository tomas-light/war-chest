import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { PlayerPositionChangedEventData } from '../../events.js';
import type { GameState, GameTeams } from '../../state.js';
import type { PlayerPositionChangedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class PlayerPositionChangedEvent implements ApplicableEvent<PlayerPositionChangedEventData> {
  private constructor(readonly data: PlayerPositionChangedEventData) {}

  static fromData(
    data: PlayerPositionChangedEventData
  ): PlayerPositionChangedEvent {
    return new PlayerPositionChangedEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    const player = state.players.find(
      (candidate) => candidate.id === this.data.payload.playerId
    );

    if (player === undefined) {
      throw new Error(
        `Player ${this.data.payload.playerId} cannot change position before joining.`
      );
    }

    return {
      ...state,
      lastEventSequence: this.data.sequence,
      players: state.players.map((candidate) =>
        candidate.id === this.data.payload.playerId
          ? {
              ...candidate,
              seat: this.data.payload.seat,
              team: this.data.payload.team,
            }
          : candidate
      ),
      teams: movePlayerBetweenTeams(
        state.teams,
        this.data.payload.playerId,
        this.data.payload.team
      ),
    };
  }

  toData(): PlayerPositionChangedEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }

  toViewData(): PlayerPositionChangedViewEventData {
    return this.toData();
  }
}

function movePlayerBetweenTeams(
  teams: GameTeams,
  playerId: string,
  nextTeam: 'black' | 'white'
): GameTeams {
  const teamsWithoutPlayer = {
    black: teams.black.filter((candidateId) => candidateId !== playerId),
    white: teams.white.filter((candidateId) => candidateId !== playerId),
  };

  return {
    ...teamsWithoutPlayer,
    [nextTeam]: [...teamsWithoutPlayer[nextTeam], playerId],
  };
}
