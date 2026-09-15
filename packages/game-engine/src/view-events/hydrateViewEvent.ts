import type { GameViewEventData } from '../viewEvents.js';
import {
  type ApplicableViewEvent,
  type ViewEventHydrator,
} from './ApplicableViewEvent.js';
import { hydrateCardSelectionViewEvent } from './card-selection/hydrateCardSelectionViewEvent.js';
import { hydrateLifecycleViewEvent } from './lifecycle/hydrateLifecycleViewEvent.js';
import { hydrateSynchronizationViewEvent } from './synchronization/hydrateSynchronizationViewEvent.js';
import { hydrateTestScenarioViewEvent } from './test-scenario/hydrateTestScenarioViewEvent.js';

const VIEW_EVENT_HYDRATORS: readonly ViewEventHydrator[] = [
  hydrateCardSelectionViewEvent,
  hydrateLifecycleViewEvent,
  hydrateTestScenarioViewEvent,
  hydrateSynchronizationViewEvent,
];

export function hydrateViewEvent(data: GameViewEventData): ApplicableViewEvent {
  for (const hydrateViewEventGroup of VIEW_EVENT_HYDRATORS) {
    const event = hydrateViewEventGroup(data);

    if (event !== null) {
      return event;
    }
  }

  throw new Error(`Unsupported game view event type: ${data.type}`);
}
