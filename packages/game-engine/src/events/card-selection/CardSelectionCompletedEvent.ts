import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { CardSelectionCompletedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { CardSelectionCompletedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class CardSelectionCompletedEvent implements ApplicableEvent<CardSelectionCompletedEventData> {
  private constructor(readonly data: CardSelectionCompletedEventData) {}

  static fromData(
    data: CardSelectionCompletedEventData
  ): CardSelectionCompletedEvent {
    return new CardSelectionCompletedEvent({ ...data, payload: {} });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      cardSelection: null,
      currentPlayerId: state.firstPlayerId,
      lastEventSequence: this.data.sequence,
      status: 'active',
    };
  }

  toData(): CardSelectionCompletedEventData {
    return { ...this.data, payload: {} };
  }

  toViewData(): CardSelectionCompletedViewEventData {
    return this.toData();
  }
}
