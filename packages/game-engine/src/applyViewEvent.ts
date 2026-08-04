import type { GameView } from './state.js';
import { hydrateViewEvent } from './view-events/hydrateViewEvent.js';
import type { GameViewEventData } from './viewEvents.js';

export function applyViewEvent(
  view: GameView | null,
  data: GameViewEventData
): GameView {
  return hydrateViewEvent(data).apply(view);
}
