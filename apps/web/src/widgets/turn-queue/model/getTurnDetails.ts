import type { CellId, GameViewEventData, UnitId } from '@war-chest/game-engine';
import { restoreHistoricalView } from '#/entities/game-session';

interface TurnDetails {
  action: 'deploy' | 'move' | 'pass' | 'recruit';
  cellId: CellId | null;
  fromCellId: CellId | null;
  moveNumber: number;
  round: number;
  unitId: UnitId | null;
}

export function getTurnDetails(
  events: readonly GameViewEventData[],
  sequence: number
): TurnDetails | null {
  const event = events.find((event) => event.sequence === sequence);

  if (event?.type !== 'TurnPassed' && event?.type !== 'TurnActionPerformed') {
    return null;
  }

  const before = restoreHistoricalView(events, sequence - 1);
  const detail: TurnDetails = {
    action: 'pass',
    cellId: null,
    fromCellId: null,
    moveNumber: event.payload.moveNumber,
    round: before.battlefield?.round ?? event.payload.battlefield.round,
    unitId: null,
  };

  if (event.payload.coin?.kind === 'unit') {
    detail.unitId = event.payload.coin.unitId;
  }

  if (event.type === 'TurnPassed') {
    return detail;
  }

  const action = event.payload.action;
  detail.action = action.type;

  if (action.type === 'recruit') {
    detail.unitId = action.unitId;
  } else if (action.type === 'move') {
    const unit = before.battlefield?.units.find(
      (unit) => unit.id === action.battlefieldUnitId
    );
    detail.unitId = unit?.unitId ?? null;
    detail.fromCellId = unit?.cellId ?? null;
    detail.cellId = action.cellId;
  } else if (action.type === 'deploy') {
    detail.cellId = action.cellId;
    const unit = event.payload.battlefield.units.find(
      (unit) => unit.cellId === action.cellId
    );
    detail.unitId = unit?.unitId ?? detail.unitId;
  }

  return detail;
}
