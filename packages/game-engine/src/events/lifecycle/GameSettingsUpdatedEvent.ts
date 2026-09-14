import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { GameSettingsUpdatedEventData } from '../../events.js';
import { cloneGamePreparationSettings } from '../../GameSettings.js';
import type { GameState } from '../../state.js';
import type { GameSettingsUpdatedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

type SettingsEvent = ApplicableEvent<GameSettingsUpdatedEventData>;

export class GameSettingsUpdatedEvent implements SettingsEvent {
  private constructor(readonly data: GameSettingsUpdatedEventData) {}

  static fromData(
    data: GameSettingsUpdatedEventData
  ): GameSettingsUpdatedEvent {
    return new GameSettingsUpdatedEvent({
      ...data,
      payload: cloneGamePreparationSettings(data.payload),
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      lastEventSequence: this.data.sequence,
      settings: {
        ...state.settings,
        ...cloneGamePreparationSettings(this.data.payload),
      },
    };
  }

  toData(): GameSettingsUpdatedEventData {
    return {
      ...this.data,
      payload: cloneGamePreparationSettings(this.data.payload),
    };
  }

  toViewData(): GameSettingsUpdatedViewEventData {
    return this.toData();
  }
}
