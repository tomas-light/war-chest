import type { GameView } from '../state.js';
import type { GameViewEventData } from '../viewEvents.js';

export interface ApplicableViewEvent<
  Data extends GameViewEventData = GameViewEventData,
> {
  readonly data: Data;

  apply(view: GameView | null): GameView;
  toData(): Data;
}

export type ViewEventHydrator = (
  data: GameViewEventData
) => ApplicableViewEvent | null;
