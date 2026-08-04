import { hydrateEvent } from './events/hydrateEvent.js';
import type { GameEventData } from './events.js';
import type { Viewer } from './state.js';
import type { GameViewEventData } from './viewEvents.js';

export function createViewEventFor(
  event: GameEventData,
  viewer: Viewer
): GameViewEventData {
  return hydrateEvent(event).toViewData(viewer);
}
