import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { GameStartedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class GameStartedViewEvent implements ApplicableViewEvent<GameStartedViewEventData> {
  private constructor(readonly data: GameStartedViewEventData) {}

  static fromData(data: GameStartedViewEventData): GameStartedViewEvent {
    return new GameStartedViewEvent({
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
      currentPlayerId: this.data.payload.firstPlayerId,
      lastEventSequence: this.data.sequence,
      status: 'active',
    };
  }

  toData(): GameStartedViewEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }
}
