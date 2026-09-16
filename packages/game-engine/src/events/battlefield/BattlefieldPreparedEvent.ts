import { cloneBattlefield } from '../../Battlefield.js';
import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { BattlefieldPreparedEventData } from '../../events.js';
import type { GameState, Viewer } from '../../state.js';
import type { BattlefieldPreparedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

type EventData = BattlefieldPreparedEventData;

export class BattlefieldPreparedEvent implements ApplicableEvent<EventData> {
  private constructor(readonly data: EventData) {}

  static fromData(data: EventData): BattlefieldPreparedEvent {
    return new BattlefieldPreparedEvent({
      ...data,
      payload: cloneBattlefield(data.payload),
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      battlefield: cloneBattlefield(this.data.payload),
      lastEventSequence: this.data.sequence,
    };
  }

  toData(): EventData {
    return { ...this.data, payload: cloneBattlefield(this.data.payload) };
  }

  toViewData(viewer: Viewer): BattlefieldPreparedViewEventData {
    return {
      ...this.data,
      payload: {
        controlPoints: this.data.payload.controlPoints.map((point) => ({
          ...point,
        })),
        playerResources: this.data.payload.playerResources.map((resources) => {
          const canSeeHand =
            viewer.role === 'player' && viewer.playerId === resources.playerId;

          return {
            bagCount: canSeeHand ? resources.bag.length : null,
            eliminated: [...resources.eliminated],
            hand: canSeeHand ? [...resources.hand] : null,
            handCount: resources.hand.length,
            playerId: resources.playerId,
            supply: resources.supply.map((item) => ({ ...item })),
          };
        }),
        units: this.data.payload.units.map((unit) => ({ ...unit })),
      },
    };
  }
}
