import type { GameViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';
import { ViewSequenceAdvancedEvent } from './ViewSequenceAdvancedEvent.js';

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
