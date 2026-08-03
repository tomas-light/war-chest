import type { GameView } from './state.js';
import { hydrateViewEvent } from './view-events/hydrate-view-event.js';
import type { GameViewEventData } from './view-events.js';

export function applyViewEvent(
  view: GameView | null,
  data: GameViewEventData
): GameView {
  return hydrateViewEvent(data).apply(view);
}
