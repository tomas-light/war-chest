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
import { type ReactNode, useRef, useState } from 'react';
import { Heart, Ore, UnitToken } from '#/entities/game-assets';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './BattlefieldBoard.module.scss';

interface Props {
  battlefield: GameViewBattlefieldState;
  format: GameFormat;
  initiativeOwnerName: string;
  perspective: GameTeam;
  players: readonly GameViewPlayer[];
}

interface Point {
  x: number;
  y: number;
}

interface Pan {
  x: number;
  y: number;
}

interface BattlefieldProjection {
  centerXPercent: number;
  horizontalStepPercent: number;
  originYPercent: number;
  verticalStepPercent: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.25;
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
  const { battlefield, format, initiativeOwnerName, perspective, players } =
    props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'BattlefieldBoard',
  });

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{
    distance: number;
    pan: Pan;
    scale: number;
  } | null>(null);

  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const layout = getBattlefieldLayout(format);
  const isFlipped = perspective === 'black';
  const oreSize = format === 'duel' ? 'large' : 'compact';
  const unitSize = format === 'duel' ? 'large' : 'regular';

  return (
    <section className={classes.boardSection}>
      <p className={classes.initiative}>
        {t('initiative', { player: initiativeOwnerName })}
      </p>
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
              </span>
            );
          })}

          {battlefield.units.map((unit) => {
            const point = projectCell(unit.cellId, format, isFlipped);
            const ownerTeam = getOwnerTeam(unit.ownerId);
            const color = ownerTeam === perspective ? 'cyan' : 'red';

            return (
              <span
                className={classes.unit}
                key={unit.id}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                <UnitToken
                  alt={t('unit', { cellId: unit.cellId, unit: unit.unitId })}
                  color={color}
                  size={unitSize}
                  unit={unit.unitId}
                />
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
          disabled={scale <= MIN_SCALE}
          onClick={() => changeScale(-SCALE_STEP)}
          type="button"
        >
          −
        </button>
        <button aria-label={t('resetZoom')} onClick={resetView} type="button">
          {Math.round(scale * 100)}%
        </button>
        <button
          aria-label={t('zoomIn')}
          disabled={scale >= MAX_SCALE}
          onClick={() => changeScale(SCALE_STEP)}
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

  function changeScale(delta: number): void {
    const nextScale = clamp(scale + delta, MIN_SCALE, MAX_SCALE);

    setScale(nextScale);
    setPan((currentPan) => constrainPan(currentPan, nextScale));
  }

  function resetView(): void {
    setPan({ x: 0, y: 0 });
    setScale(1);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    startGesture();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const previousPoint = pointersRef.current.get(event.pointerId);
    if (previousPoint === undefined) {
      return;
    }

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    const points = [...pointersRef.current.values()];

    if (points.length === 1 && scale > 1) {
      const [point] = points;
      if (point === undefined) {
        return;
      }

      setPan((currentPan) =>
        constrainPan(
          {
            x: currentPan.x + point.x - previousPoint.x,
            y: currentPan.y + point.y - previousPoint.y,
          },
          scale
        )
      );
      return;
    }

    if (points.length !== 2 || gestureRef.current === null) {
      return;
    }

    const [firstPoint, secondPoint] = points;
    if (firstPoint === undefined || secondPoint === undefined) {
      return;
    }

    const distance = getDistance(firstPoint, secondPoint);
    const nextScale = clamp(
      gestureRef.current.scale * (distance / gestureRef.current.distance),
      MIN_SCALE,
      MAX_SCALE
    );

    setScale(nextScale);
    setPan(constrainPan(gestureRef.current.pan, nextScale));
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>): void {
    pointersRef.current.delete(event.pointerId);
    startGesture();
  }

  function startGesture(): void {
    const points = [...pointersRef.current.values()];
    if (points.length !== 2) {
      gestureRef.current = null;
      return;
    }

    const [firstPoint, secondPoint] = points;
    if (firstPoint === undefined || secondPoint === undefined) {
      return;
    }

    gestureRef.current = {
      distance: getDistance(firstPoint, secondPoint),
      pan,
      scale,
    };
  }

  function constrainPan(nextPan: Pan, nextScale: number): Pan {
    const viewport = viewportRef.current;
    if (viewport === null || nextScale <= 1) {
      return { x: 0, y: 0 };
    }

    const maximumX = (viewport.clientWidth * (nextScale - 1)) / 2;
    const maximumY = (viewport.clientHeight * (nextScale - 1)) / 2;

    return {
      x: clamp(nextPan.x, -maximumX, maximumX),
      y: clamp(nextPan.y, -maximumY, maximumY),
    };
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

function getDistance(firstPoint: Point, secondPoint: Point): number {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
