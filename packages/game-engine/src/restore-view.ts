import { applyViewEvent } from './apply-view-event.js';
import type { GameView } from './state.js';
import type { GameViewEventData } from './view-events.js';

export function restoreView(
  events: readonly GameViewEventData[]
): GameView | null {
  return events.reduce<GameView | null>(applyViewEvent, null);
}
