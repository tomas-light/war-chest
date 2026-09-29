import type { GameViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';
import { TurnActionPerformedViewEvent } from './TurnActionPerformedViewEvent.js';
import { TurnPassedViewEvent } from './TurnPassedViewEvent.js';

export function hydrateTurnViewEvent(
  data: GameViewEventData
): ApplicableViewEvent | null {
  if (data.type === 'TurnActionPerformed') {
    return TurnActionPerformedViewEvent.fromData(data);
  }

  if (data.type === 'TurnPassed') {
    return TurnPassedViewEvent.fromData(data);
  }

  return null;
}
