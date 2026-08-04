import { NullableGameViewError } from '../../errors/nullable-game-view-error.js';
import type { GameView } from '../../state.js';
import type { PlayerJoinedViewEventData } from '../../view-events.js';
import type { ApplicableViewEvent } from '../applicable-view-event.js';

// eslint-disable-next-line max-len
export class PlayerJoinedViewEvent implements ApplicableViewEvent<PlayerJoinedViewEventData> {
  private constructor(readonly data: PlayerJoinedViewEventData) {}

  static fromData(data: PlayerJoinedViewEventData): PlayerJoinedViewEvent {
    return new PlayerJoinedViewEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      lastEventSequence: this.data.sequence,
      players: [
        ...view.players,
        {
          id: this.data.payload.playerId,
          moveCount: 0,
          seat: this.data.payload.seat,
          team: this.data.payload.team,
        },
      ],
      teams: {
        ...view.teams,
        [this.data.payload.team]: [
          ...view.teams[this.data.payload.team],
          this.data.payload.playerId,
        ],
      },
    };
  }

  toData(): PlayerJoinedViewEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }
}
