import type { GameEventData } from '../events.js';
import type { GameState, Viewer } from '../state.js';
import type { GameViewEventData } from '../view-events.js';

export interface ApplicableEvent<Data extends GameEventData = GameEventData> {
  readonly data: Data;

  apply(state: GameState | null): GameState;
  toData(): Data;
  toViewData(viewer: Viewer): GameViewEventData;
}

export type EventHydrator = (data: GameEventData) => ApplicableEvent | null;
