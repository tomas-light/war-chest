import type { GameViewEventData } from '../view-events.js';
import {
  type ApplicableViewEvent,
  type ViewEventHydrator,
} from './applicable-view-event.js';
import { hydrateLifecycleViewEvent } from './lifecycle/hydrate-lifecycle-view-event.js';
import { hydrateSynchronizationViewEvent } from './synchronization/hydrate-synchronization-view-event.js';
import { hydrateTestScenarioViewEvent } from './test-scenario/hydrate-test-scenario-view-event.js';

const VIEW_EVENT_HYDRATORS: readonly ViewEventHydrator[] = [
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
