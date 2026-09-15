import type { CompleteCardSelectionCommandData } from '../../command-data/CardSelectionCommandData.js';
import type { GameEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { createCardSelectionCompletionEvents } from './createCardSelectionCompletionEvents.js';

// eslint-disable-next-line max-len
export class CompleteCardSelectionCommand implements DecidableCommand<CompleteCardSelectionCommandData> {
  private constructor(readonly data: CompleteCardSelectionCommandData) {}

  static fromData(
    data: CompleteCardSelectionCommandData
  ): CompleteCardSelectionCommand {
    return new CompleteCardSelectionCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const player = state.players.find((item) => item.id === playerId);

    if (state.status !== 'cardSelection' || player?.presence !== 'connected') {
      return [];
    }

    return createCardSelectionCompletionEvents(state);
  }

  toData(): CompleteCardSelectionCommandData {
    return { ...this.data };
  }
}
