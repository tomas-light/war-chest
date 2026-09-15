import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { CardSelectionCompletedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class CardSelectionCompletedViewEvent implements ApplicableViewEvent<CardSelectionCompletedViewEventData> {
  private constructor(readonly data: CardSelectionCompletedViewEventData) {}

  static fromData(
    data: CardSelectionCompletedViewEventData
  ): CardSelectionCompletedViewEvent {
    return new CardSelectionCompletedViewEvent({ ...data, payload: {} });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      cardSelection: null,
      currentPlayerId: view.firstPlayerId,
      lastEventSequence: this.data.sequence,
      status: 'active',
    };
  }

  toData(): CardSelectionCompletedViewEventData {
    return { ...this.data, payload: {} };
  }
}
