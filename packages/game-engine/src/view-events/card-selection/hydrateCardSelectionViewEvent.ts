import type { GameViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';
import { CardChoiceConfirmedViewEvent } from './CardChoiceConfirmedViewEvent.js';
import { CardSelectionCompletedViewEvent } from './CardSelectionCompletedViewEvent.js';
import { CardsPreparedViewEvent } from './CardsPreparedViewEvent.js';

export function hydrateCardSelectionViewEvent(
  data: GameViewEventData
): ApplicableViewEvent | null {
  if (data.type === 'CardsPrepared') {
    return CardsPreparedViewEvent.fromData(data);
  }

  if (data.type === 'CardChoiceConfirmed') {
    return CardChoiceConfirmedViewEvent.fromData(data);
  }

  if (data.type === 'CardSelectionCompleted') {
    return CardSelectionCompletedViewEvent.fromData(data);
  }

  return null;
}
