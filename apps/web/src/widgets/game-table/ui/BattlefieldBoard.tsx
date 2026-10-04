import {
  type BattlefieldControlPoint,
  type BattlefieldLayoutCell,
  type CellId,
  type GameFormat,
  type GameTeam,
  type GameViewBattlefieldState,
  type GameViewPlayer,
  getBattlefieldLayout,
} from '@war-chest/game-engine';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import {
  AvailableMoveHighlight,
  Heart,
  Ore,
  UnitToken,
} from '#/entities/game-assets';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { useBattlefieldViewport } from '../model/useBattlefieldViewport';
import classes from './BattlefieldBoard.module.scss';

interface Props {
  battlefield: GameViewBattlefieldState;
  deployCells?: readonly CellId[];
  format: GameFormat;
  moveCells?: readonly CellId[];
  movableUnitIds?: readonly string[];
  onDeployCellClick?(this: void, cellId: CellId): void;
  onMoveCellClick?(this: void, cellId: CellId): void;
  onMoveUnitClick?(
    this: void,
    battlefieldUnitId: string,
    anchorElement: HTMLButtonElement
  ): void;
  perspective: GameTeam;
  players: readonly GameViewPlayer[];
  selectedUnitId?: string | null;
}

interface Point {
  x: number;
  y: number;
}

interface BattlefieldProjection {
  centerXPercent: number;
  horizontalStepPercent: number;
  originYPercent: number;
  verticalStepPercent: number;
}

const LAST_CANONICAL_CELL_INDEX = 6;

// Pixel-perfect cell centers measured in the corresponding Figma battlefield
// frames and converted to percentages so they scale with the board canvas.
const DUEL_PROJECTION: BattlefieldProjection = {
  centerXPercent: 50,
  horizontalStepPercent: 6.727,
  originYPercent: 93.5,
  verticalStepPercent: 7.253,
};
const TEAM_PROJECTION: BattlefieldProjection = {
  centerXPercent: 50,
  horizontalStepPercent: 5.422,
  originYPercent: 85.074,
  verticalStepPercent: 5.846,
};

export function BattlefieldBoard(props: Props) {
  const {
    battlefield,
    deployCells,
    format,
    moveCells,
    movableUnitIds,
    onDeployCellClick,
    onMoveCellClick,
    onMoveUnitClick,
    perspective,
    players,
    selectedUnitId,
  } = props;

  const { t } = useTranslation('widgets/game-table', {
    keyPrefix: 'BattlefieldBoard',
  });

  const {
    canZoomIn,
    canZoomOut,
    handlePointerDown,
    handlePointerEnd,
    handlePointerMove,
    pan,
    resetView,
    scale,
    viewportRef,
    zoomIn,
    zoomOut,
  } = useBattlefieldViewport();

  const layout = getBattlefieldLayout(format);
  const isFlipped = perspective === 'black';
  const oreSize = format === 'duel' ? 'large' : 'compact';

  return (
    <section className={classes.boardSection}>
      <div
        className={classes.viewport}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        ref={viewportRef}
      >
        <div
          className={classes.canvas}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          }}
        >
          {layout.cells.map((cell) => {
            const point = projectCell(cell.cellId, format, isFlipped);
            let content: ReactNode;

            if (cell.kind === 'controlPoint') {
              const controlPoint = getControlPoint(cell);

              content = (
                <Ore
                  alt={t('controlPoint', { cellId: cell.cellId })}
                  availableToMove={moveCells?.includes(cell.cellId)}
                  color={getControlPointColor(controlPoint)}
                  fortified={controlPoint.fortified}
                  size={oreSize}
                  underUnit={battlefield.units.some(
                    (unit) => unit.cellId === cell.cellId
                  )}
                />
              );
            }

            return (
              <span
                aria-label={t('cell', { cellId: cell.cellId })}
                className={clsx(classes.cell, {
                  [classes.compactCell]:
                    format === 'team' && cell.kind === 'ground',
                  [classes.compactControlPointCell]:
                    format === 'team' && cell.kind === 'controlPoint',
                  [classes.controlPointCell]: cell.kind === 'controlPoint',
                  [classes.duelCell]:
                    format === 'duel' && cell.kind === 'ground',
                  [classes.teamCoreCell]:
                    format === 'team' &&
                    cell.kind === 'ground' &&
                    cell.zone === 'core',
                  [classes.teamZoneCell]:
                    format === 'team' &&
                    cell.kind === 'ground' &&
                    cell.zone === 'team',
                })}
                data-kind={cell.kind}
                data-zone={cell.zone}
                key={cell.cellId}
                role="gridcell"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                tabIndex={0}
              >
                {content}
                {deployCells?.includes(cell.cellId) && onDeployCellClick && (
                  <button
                    aria-label={t('deployToCell', { cellId: cell.cellId })}
                    className={classes.deployTarget}
                    onClick={() => onDeployCellClick(cell.cellId)}
                    type="button"
                  >
                    +
                  </button>
                )}
                {moveCells?.includes(cell.cellId) && onMoveCellClick && (
                  <button
                    aria-label={t('moveToCell', { cellId: cell.cellId })}
                    className={classes.moveTarget}
                    onClick={() => onMoveCellClick(cell.cellId)}
                    type="button"
                  >
                    {cell.kind === 'ground' && (
                      <AvailableMoveHighlight
                        className={classes.groundMoveHighlight}
                        size={oreSize}
                      />
                    )}
                  </button>
                )}
              </span>
            );
          })}

          {battlefield.units.map((unit) => {
            const point = projectCell(unit.cellId, format, isFlipped);
            const ownerTeam = getOwnerTeam(unit.ownerId);
            const color = ownerTeam === perspective ? 'cyan' : 'red';

            return (
              <span
                className={clsx(classes.unit, {
                  [classes.compactUnit]: format === 'team',
                })}
                data-cell-id={unit.cellId}
                data-unit-id={unit.id}
                key={unit.id}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <UnitToken
                  alt={t('unit', { cellId: unit.cellId, unit: unit.unitId })}
                  className={classes.battlefieldUnitToken}
                  color={color}
                  unit={unit.unitId}
                />
                {movableUnitIds?.includes(unit.id) && onMoveUnitClick && (
                  <button
                    aria-label={t('selectMoveUnit', {
                      cellId: unit.cellId,
                      unit: unit.unitId,
                    })}
                    aria-pressed={selectedUnitId === unit.id}
                    className={classes.unitSelection}
                    onClick={(event) =>
                      onMoveUnitClick(unit.id, event.currentTarget)
                    }
                    type="button"
                  />
                )}
                {Array.from({ length: unit.bolstered }, (_, index) => (
                  <Heart
                    alt=""
                    className={classes.heart}
                    key={`${unit.id}-heart-${index}`}
                    state="intact"
                  />
                ))}
              </span>
            );
          })}

          <svg aria-hidden="true" className={classes.effects} />
        </div>
      </div>
      <div
        aria-label={t('zoomControls')}
        className={classes.controls}
        role="group"
      >
        <button
          aria-label={t('zoomOut')}
          disabled={!canZoomOut}
          onClick={zoomOut}
          type="button"
        >
          −
        </button>
        <button aria-label={t('resetZoom')} onClick={resetView} type="button">
          {Math.round(scale * 100)}%
        </button>
        <button
          aria-label={t('zoomIn')}
          disabled={!canZoomIn}
          onClick={zoomIn}
          type="button"
        >
          +
        </button>
      </div>
    </section>
  );

  function getOwnerTeam(ownerId: string): GameTeam {
    const owner = players.find((player) => player.id === ownerId);

    return owner?.team ?? perspective;
  }

  function getControlPoint(
    cell: BattlefieldLayoutCell
  ): BattlefieldControlPoint {
    const controlPoint = battlefield.controlPoints.find(
      (item) => item.cellId === cell.cellId
    );

    if (controlPoint === undefined) {
      throw new Error(`Missing control point state for cell ${cell.cellId}.`);
    }

    return controlPoint;
  }

  function getControlPointColor(
    controlPoint: BattlefieldControlPoint
  ): 'cyan' | 'neutral' | 'red' {
    if (controlPoint.ownerTeam === 'white') {
      return isFlipped ? 'red' : 'cyan';
    }

    if (controlPoint.ownerTeam === 'black') {
      return isFlipped ? 'cyan' : 'red';
    }

    return 'neutral';
  }
}

function projectCell(
  cellId: CellId,
  format: GameFormat,
  isFlipped: boolean
): Point {
  const column = cellId.charCodeAt(0) - 'A'.charCodeAt(0);
  const row = Number(cellId[1]) - 1;
  let projectedColumn = column;
  let projectedRow = row;

  if (isFlipped) {
    projectedColumn = LAST_CANONICAL_CELL_INDEX - column;
    projectedRow = LAST_CANONICAL_CELL_INDEX - row;
  }

  let projection = TEAM_PROJECTION;
  if (format === 'duel') {
    projection = DUEL_PROJECTION;
  }

  return {
    x:
      projection.centerXPercent +
      (projectedColumn - projectedRow) * projection.horizontalStepPercent,
    y:
      projection.originYPercent -
      (projectedColumn + projectedRow) * projection.verticalStepPercent,
  };
}
