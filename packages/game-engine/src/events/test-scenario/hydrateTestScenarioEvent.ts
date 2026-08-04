import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';
import { TestMovePerformedEvent } from './TestMovePerformedEvent.js';

export function hydrateTestScenarioEvent(
  data: GameEventData
): ApplicableEvent | null {
  switch (data.type) {
    case 'TestMovePerformed':
      return TestMovePerformedEvent.fromData(data);
    default:
      return null;
  }
}
