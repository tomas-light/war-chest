import {
  createNextCardChoice,
  getCurrentCardSelectionPlayer,
} from '../../CardSelection.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';

export function createCardSelectionCompletionEvents(
  state: GameState
): GameEventData[] {
  const selection = state.cardSelection;
  if (state.status !== 'cardSelection' || selection === null) {
    return [];
  }

  const events: GameEventData[] = [];
  if (selection.phase !== 'complete') {
    const remainingCards = selection.pool.filter(
      (unitId) => !selection.choices.some((choice) => choice.unitId === unitId)
    );
    const [unitId] = remainingCards;
    const playerId = getCurrentCardSelectionPlayer(selection);
    if (
      selection.phase !== 'picking' ||
      remainingCards.length !== 1 ||
      unitId === undefined ||
      playerId === null
    ) {
      return [];
    }

    const finalChoice = createNextCardChoice({
      action: 'pick',
      playerId,
      state: selection,
      unitId,
    });
    if (finalChoice === null || !finalChoice.isComplete) {
      return [];
    }

    events.push({
      payload: {
        ...finalChoice.choice,
        isComplete: true,
        nextPhase: 'complete',
        nextPlayerId: null,
      },
      sequence: state.lastEventSequence + 1,
      type: 'CardChoiceConfirmed',
      version: GAME_EVENT_VERSION,
    });
  }

  events.push({
    payload: {},
    sequence: state.lastEventSequence + events.length + 1,
    type: 'CardSelectionCompleted',
    version: GAME_EVENT_VERSION,
  });
  return events;
}
