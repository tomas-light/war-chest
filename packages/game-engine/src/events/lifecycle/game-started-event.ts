import { NullableGameStateError } from '../../errors/nullable-game-state-error.js';
import type { GameStartedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { GameStartedViewEventData } from '../../view-events.js';
import type { ApplicableEvent } from '../applicable-event.js';

export class GameStartedEvent implements ApplicableEvent<GameStartedEventData> {
  private constructor(readonly data: GameStartedEventData) {}

  static fromData(data: GameStartedEventData): GameStartedEvent {
    return new GameStartedEvent({
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
      currentPlayerId: this.data.payload.firstPlayerId,
      lastEventSequence: this.data.sequence,
      status: 'active',
    };
  }

  toData(): GameStartedEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }

  toViewData(): GameStartedViewEventData {
    return this.toData();
  }
}
