import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';
import { TurnActionPerformedEvent } from './TurnActionPerformedEvent.js';
import { TurnPassedEvent } from './TurnPassedEvent.js';

export function hydrateTurnEvent(data: GameEventData): ApplicableEvent | null {
  if (data.type === 'TurnActionPerformed') {
    return TurnActionPerformedEvent.fromData(data);
  }

  if (data.type === 'TurnPassed') {
    return TurnPassedEvent.fromData(data);
  }

  return null;
}
