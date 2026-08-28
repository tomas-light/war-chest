import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameTeams, GameView } from '../../state.js';
import type { PlayerPositionChangedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class PlayerPositionChangedViewEvent implements ApplicableViewEvent<PlayerPositionChangedViewEventData> {
  private constructor(readonly data: PlayerPositionChangedViewEventData) {}

  static fromData(
    data: PlayerPositionChangedViewEventData
  ): PlayerPositionChangedViewEvent {
    return new PlayerPositionChangedViewEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    const player = view.players.find(
      (candidate) => candidate.id === this.data.payload.playerId
    );

    if (player === undefined) {
      throw new Error(
        `Player ${this.data.payload.playerId} cannot change position before joining.`
      );
    }

    return {
      ...view,
      lastEventSequence: this.data.sequence,
      players: view.players.map((candidate) =>
        candidate.id === this.data.payload.playerId
          ? {
              ...candidate,
              seat: this.data.payload.seat,
              team: this.data.payload.team,
            }
          : candidate
      ),
      teams: movePlayerBetweenTeams(
        view.teams,
        this.data.payload.playerId,
        this.data.payload.team
      ),
    };
  }

  toData(): PlayerPositionChangedViewEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
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
