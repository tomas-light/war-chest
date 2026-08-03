import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../applicable-event.js';
import { TestMovePerformedEvent } from './test-move-performed-event.js';

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
