import type { CellId } from '../Battlefield.js';
import type { UnitId } from '../UnitId.js';

export interface PassTurnCommandData {
  coinIndex: number;
  type: 'PassTurn';
}

export type UnitManeuver = {
  battlefieldUnitId: string;
  cellId: CellId;
  type: 'move';
};

export type TurnAction =
  | { cellId: CellId; type: 'deploy' }
  | UnitManeuver
  | { maneuvers: UnitManeuver[]; type: 'tactic'; unitId: UnitId }
  | { type: 'recruit'; unitId: UnitId };

export interface PerformTurnActionCommandData {
  action: TurnAction;
  coinIndex: number;
  type: 'PerformTurnAction';
}

export type TurnCommandData =
  PassTurnCommandData | PerformTurnActionCommandData;
