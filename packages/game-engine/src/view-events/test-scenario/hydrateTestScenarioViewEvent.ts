import type { GameViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';
import { TestMovePerformedViewEvent } from './TestMovePerformedViewEvent.js';

export function hydrateTestScenarioViewEvent(
  data: GameViewEventData
): ApplicableViewEvent | null {
  switch (data.type) {
    case 'TestMovePerformed':
      return TestMovePerformedViewEvent.fromData(data);
    default:
      return null;
  }
}
