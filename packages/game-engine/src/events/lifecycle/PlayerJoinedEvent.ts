import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { PlayerJoinedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { PlayerJoinedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class PlayerJoinedEvent implements ApplicableEvent<PlayerJoinedEventData> {
  private constructor(readonly data: PlayerJoinedEventData) {}

  static fromData(data: PlayerJoinedEventData): PlayerJoinedEvent {
    return new PlayerJoinedEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      lastEventSequence: this.data.sequence,
      players: [
        ...state.players,
        {
          defeatReason: null,
          id: this.data.payload.playerId,
          moveCount: 0,
          presence: 'connected',
          privateMoves: [],
          reconnectDeadline: null,
          seat: this.data.payload.seat,
          team: this.data.payload.team,
        },
      ],
      teams: {
        ...state.teams,
        [this.data.payload.team]: [
          ...state.teams[this.data.payload.team],
          this.data.payload.playerId,
        ],
      },
    };
  }

  toData(): PlayerJoinedEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }

  toViewData(): PlayerJoinedViewEventData {
    return this.toData();
  }
}
