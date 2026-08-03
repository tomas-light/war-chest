import { hydrateEvent } from './events/hydrate-event.js';
import type { GameEventData } from './events.js';
import type { Viewer } from './state.js';
import type { GameViewEventData } from './view-events.js';

export function createViewEventFor(
  event: GameEventData,
  viewer: Viewer
): GameViewEventData {
  return hydrateEvent(event).toViewData(viewer);
}
