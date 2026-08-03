import type { GameCommandData } from '../commands.js';
import type { GameEventData } from '../events.js';
import type { GameState } from '../state.js';

export interface DecidableCommand<
  Data extends GameCommandData = GameCommandData,
> {
  readonly data: Data;

  decide(state: GameState, playerId: string): GameEventData[];
  toData(): Data;
}

export type CommandHydrator = (
  data: GameCommandData
) => DecidableCommand | null;
