import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { BattlefieldPreparedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

type EventData = BattlefieldPreparedViewEventData;
type BattlefieldEvent = ApplicableViewEvent<EventData>;

export class BattlefieldPreparedViewEvent implements BattlefieldEvent {
  private constructor(readonly data: EventData) {}

  static fromData(data: EventData): BattlefieldPreparedViewEvent {
    return new BattlefieldPreparedViewEvent({
      ...data,
      payload: cloneViewBattlefield(data.payload),
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      battlefield: cloneViewBattlefield(this.data.payload),
      lastEventSequence: this.data.sequence,
    };
  }

  toData(): EventData {
    return { ...this.data, payload: cloneViewBattlefield(this.data.payload) };
  }
}

function cloneViewBattlefield(
  battlefield: BattlefieldPreparedViewEventData['payload']
): BattlefieldPreparedViewEventData['payload'] {
  return {
    controlPoints: battlefield.controlPoints.map((point) => ({ ...point })),
    playerResources: battlefield.playerResources.map((resources) => ({
      ...resources,
      eliminated: [...resources.eliminated],
      hand: resources.hand === null ? null : [...resources.hand],
      supply: resources.supply.map((item) => ({ ...item })),
    })),
    units: battlefield.units.map((unit) => ({ ...unit })),
  };
}
