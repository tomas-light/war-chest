import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import { cloneGamePreparationSettings } from '../../GameSettings.js';
import type { GameView } from '../../state.js';
import type { GameSettingsUpdatedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

type SettingsViewEvent = ApplicableViewEvent<GameSettingsUpdatedViewEventData>;

export class GameSettingsUpdatedViewEvent implements SettingsViewEvent {
  private constructor(readonly data: GameSettingsUpdatedViewEventData) {}

  static fromData(
    data: GameSettingsUpdatedViewEventData
  ): GameSettingsUpdatedViewEvent {
    return new GameSettingsUpdatedViewEvent({
      ...data,
      payload: cloneGamePreparationSettings(data.payload),
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      lastEventSequence: this.data.sequence,
      settings: {
        ...view.settings,
        ...cloneGamePreparationSettings(this.data.payload),
      },
    };
  }

  toData(): GameSettingsUpdatedViewEventData {
    return {
      ...this.data,
      payload: cloneGamePreparationSettings(this.data.payload),
    };
  }
}
