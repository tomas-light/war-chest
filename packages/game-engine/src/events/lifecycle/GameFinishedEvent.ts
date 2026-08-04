import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { GameFinishedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { GameFinishedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class GameFinishedEvent implements ApplicableEvent<GameFinishedEventData> {
  private constructor(readonly data: GameFinishedEventData) {}

  static fromData(data: GameFinishedEventData): GameFinishedEvent {
    return new GameFinishedEvent({
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
      currentPlayerId: null,
      lastEventSequence: this.data.sequence,
      status: 'finished',
      winnerTeam: this.data.payload.winnerTeam,
    };
  }

  toData(): GameFinishedEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }

  toViewData(): GameFinishedViewEventData {
    return this.toData();
  }
}
