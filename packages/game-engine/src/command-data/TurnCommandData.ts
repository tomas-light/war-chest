import type { CellId } from '../Battlefield.js';
import type { UnitId } from '../UnitId.js';

export interface PassTurnCommandData {
  coinIndex: number;
  type: 'PassTurn';
}

export type TurnAction =
  { cellId: CellId; type: 'deploy' } | { type: 'recruit'; unitId: UnitId };

export interface PerformTurnActionCommandData {
  action: TurnAction;
  coinIndex: number;
  type: 'PerformTurnAction';
}

export type TurnCommandData =
  PassTurnCommandData | PerformTurnActionCommandData;
