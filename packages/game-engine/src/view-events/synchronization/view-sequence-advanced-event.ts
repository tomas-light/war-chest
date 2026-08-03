import { NullableGameViewError } from '../../errors/nullable-game-view-error.js';
import type { GameView } from '../../state.js';
import type { ViewSequenceAdvancedEventData } from '../../view-events.js';
import type { ApplicableViewEvent } from '../applicable-view-event.js';

// eslint-disable-next-line max-len
export class ViewSequenceAdvancedEvent implements ApplicableViewEvent<ViewSequenceAdvancedEventData> {
  private constructor(readonly data: ViewSequenceAdvancedEventData) {}

  static fromData(
    data: ViewSequenceAdvancedEventData
  ): ViewSequenceAdvancedEvent {
    return new ViewSequenceAdvancedEvent({ ...data });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      lastEventSequence: this.data.sequence,
    };
  }

  toData(): ViewSequenceAdvancedEventData {
    return { ...this.data };
  }
}
