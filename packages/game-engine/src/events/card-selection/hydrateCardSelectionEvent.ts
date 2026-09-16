import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';
import { CardChoiceConfirmedEvent } from './CardChoiceConfirmedEvent.js';
import { CardSelectionCompletedEvent } from './CardSelectionCompletedEvent.js';
import { CardsPreparedEvent } from './CardsPreparedEvent.js';

export function hydrateCardSelectionEvent(
  data: GameEventData
): ApplicableEvent | null {
  if (data.type === 'CardsPrepared') {
    return CardsPreparedEvent.fromData(data);
  }

  if (data.type === 'CardChoiceConfirmed') {
    return CardChoiceConfirmedEvent.fromData(data);
  }

  if (data.type === 'CardSelectionCompleted') {
    return CardSelectionCompletedEvent.fromData(data);
  }

  return null;
}
