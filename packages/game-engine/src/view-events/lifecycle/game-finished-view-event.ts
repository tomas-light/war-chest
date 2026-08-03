import { NullableGameViewError } from '../../errors/nullable-game-view-error.js';
import type { GameView } from '../../state.js';
import type { GameFinishedViewEventData } from '../../view-events.js';
import type { ApplicableViewEvent } from '../applicable-view-event.js';

// eslint-disable-next-line max-len
export class GameFinishedViewEvent implements ApplicableViewEvent<GameFinishedViewEventData> {
  private constructor(readonly data: GameFinishedViewEventData) {}

  static fromData(data: GameFinishedViewEventData): GameFinishedViewEvent {
    return new GameFinishedViewEvent({
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
      currentPlayerId: null,
      finishedByPlayerId: this.data.payload.finishedByPlayerId,
      lastEventSequence: this.data.sequence,
      status: 'finished',
    };
  }

  toData(): GameFinishedViewEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }
}
