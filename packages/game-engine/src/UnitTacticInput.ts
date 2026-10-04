import type { UnitManeuver } from './command-data/TurnCommandData.js';
import type { GameState, GameView } from './state.js';

export interface UnitTacticInput {
  coinIndex: number;
  game: GameState | GameView;
  maneuvers: readonly UnitManeuver[];
  playerId: string;
}

export type UnitTacticValidationMode = 'draft' | 'complete';
