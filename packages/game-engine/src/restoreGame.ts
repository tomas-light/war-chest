import { applyEvent } from './applyEvent.js';
import type { GameEventData } from './events.js';
import type { GameState } from './state.js';

export function restoreGame(
  events: readonly GameEventData[]
): GameState | null {
  return events.reduce<GameState | null>(applyEvent, null);
}
