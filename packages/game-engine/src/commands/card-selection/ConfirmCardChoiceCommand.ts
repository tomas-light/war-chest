import { createNextCardChoice } from '../../CardSelection.js';
import type { ConfirmCardChoiceCommandData } from '../../command-data/CardSelectionCommandData.js';
import { CardChoiceConfirmedEvent } from '../../events/card-selection/CardChoiceConfirmedEvent.js';
import {
  type CardChoiceConfirmedEventData,
  type GameEventData,
  GAME_EVENT_VERSION,
} from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { createCardSelectionCompletionEvents } from './createCardSelectionCompletionEvents.js';

// eslint-disable-next-line max-len
export class ConfirmCardChoiceCommand implements DecidableCommand<ConfirmCardChoiceCommandData> {
  private constructor(readonly data: ConfirmCardChoiceCommandData) {}

  static fromData(
    data: ConfirmCardChoiceCommandData
  ): ConfirmCardChoiceCommand {
    return new ConfirmCardChoiceCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const player = state.players.find((item) => item.id === playerId);

    if (
      state.status !== 'cardSelection' ||
      state.cardSelection === null ||
      player?.presence !== 'connected'
    ) {
      return [];
    }

    const action = state.cardSelection.phase === 'banning' ? 'ban' : 'pick';
    const nextChoice = createNextCardChoice({
      action,
      playerId,
      state: state.cardSelection,
      unitId: this.data.unitId,
    });

    if (nextChoice === null) {
      return [];
    }

    const event: CardChoiceConfirmedEventData = {
      payload: {
        ...nextChoice.choice,
        isComplete: nextChoice.isComplete,
        nextPhase: nextChoice.nextPhase,
        nextPlayerId: nextChoice.nextPlayerId,
      },
      sequence: state.lastEventSequence + 1,
      type: 'CardChoiceConfirmed',
      version: GAME_EVENT_VERSION,
    };
    const nextState = CardChoiceConfirmedEvent.fromData(event).apply(state);

    return [event, ...createCardSelectionCompletionEvents(nextState)];
  }

  toData(): ConfirmCardChoiceCommandData {
    return { ...this.data };
  }
}
