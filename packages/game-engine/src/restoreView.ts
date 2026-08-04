import { applyViewEvent } from './applyViewEvent.js';
import type { GameView } from './state.js';
import type { GameViewEventData } from './viewEvents.js';

export function restoreView(
  events: readonly GameViewEventData[]
): GameView | null {
  return events.reduce<GameView | null>(applyViewEvent, null);
}
