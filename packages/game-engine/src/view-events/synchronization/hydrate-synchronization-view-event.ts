import type { GameViewEventData } from '../../view-events.js';
import type { ApplicableViewEvent } from '../applicable-view-event.js';
import { ViewSequenceAdvancedEvent } from './view-sequence-advanced-event.js';

export function hydrateSynchronizationViewEvent(
  data: GameViewEventData
): ApplicableViewEvent | null {
  switch (data.type) {
    case 'ViewSequenceAdvanced':
      return ViewSequenceAdvancedEvent.fromData(data);
    default:
      return null;
  }
}
