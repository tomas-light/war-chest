import type { GameViewEventData } from '../../view-events.js';
import type { ApplicableViewEvent } from '../applicable-view-event.js';
import { TestMovePerformedViewEvent } from './test-move-performed-view-event.js';

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
