import { hydrateEvent } from './events/hydrate-event.js';
import type { GameEventData } from './events.js';
import type { GameState } from './state.js';

export function applyEvent(
  state: GameState | null,
  data: GameEventData
): GameState {
  return hydrateEvent(data).apply(state);
}
