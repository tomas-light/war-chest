import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { GameFinishedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

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
      lastEventSequence: this.data.sequence,
      status: 'finished',
      winnerTeam: this.data.payload.winnerTeam,
    };
  }

  toData(): GameFinishedViewEventData {
    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }
}
