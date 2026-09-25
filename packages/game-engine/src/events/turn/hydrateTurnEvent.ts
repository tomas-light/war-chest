import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';
import { TurnPassedEvent } from './TurnPassedEvent.js';

export function hydrateTurnEvent(data: GameEventData): ApplicableEvent | null {
  if (data.type === 'TurnPassed') {
    return TurnPassedEvent.fromData(data);
  }

  return null;
}
