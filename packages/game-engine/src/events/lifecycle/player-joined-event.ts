import { NullableGameStateError } from '../../errors/nullable-game-state-error.js';
import type { PlayerJoinedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { PlayerJoinedViewEventData } from '../../view-events.js';
import type { ApplicableEvent } from '../applicable-event.js';

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
          id: this.data.payload.playerId,
          moveCount: 0,
          privateMoves: [],
          seat: this.data.payload.seat,
        },
      ],
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
