import type { GameEventData } from '../events.js';
import { type ApplicableEvent, type EventHydrator } from './ApplicableEvent.js';
import { hydrateLifecycleEvent } from './lifecycle/hydrateLifecycleEvent.js';
import { hydrateTestScenarioEvent } from './test-scenario/hydrateTestScenarioEvent.js';

const EVENT_HYDRATORS: readonly EventHydrator[] = [
  hydrateLifecycleEvent,
  hydrateTestScenarioEvent,
];

export function hydrateEvent(data: GameEventData): ApplicableEvent {
  for (const hydrateEventGroup of EVENT_HYDRATORS) {
    const event = hydrateEventGroup(data);

    if (event !== null) {
      return event;
    }
  }

  throw new Error(`Unsupported game event type: ${data.type}`);
}
