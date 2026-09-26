import type { GameCoin, GameView } from '@war-chest/game-engine';
import {
  type CSSProperties,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Heart,
  InitiativeToken,
  RoyalToken,
  UnitToken,
} from '#/entities/game-assets';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { useGameActionMutation } from '../api/useGameActionMutation';
import deployIcon from '../assets/deployIcon.png';
import maneuverIcon from '../assets/maneuverIcon.png';
import passIcon from '../assets/passIcon.png';
import recruitIcon from '../assets/recruitIcon.png';
import type { GameWheelAction } from '../model/GameWheelAction';
import classes from './GameActions.module.scss';

interface Props {
  actions: readonly GameWheelAction[];
  anchorElement: HTMLElement;
  coin: GameCoin;
  coinIndex: number;
  gameId: string;
  onClose(this: void): void;
  onPassed(this: void, view: GameView): void;
  view: GameView;
}

interface WheelPosition {
  left: number;
  top: number;
}

interface WheelPoint {
  x: number;
  y: number;
}

interface SectorGeometry {
  buttonStyle: CSSProperties;
  contentStyle: CSSProperties;
}

const WHEEL_SIZE_PX = 270;
const WHEEL_RADIUS_PX = WHEEL_SIZE_PX / 2;
const HUB_RADIUS_PX = 35;
const CONTENT_RADIUS_PX = 92;
const LABEL_HALF_WIDTH_PX = 45;
const HORIZONTAL_CONTENT_MARGIN_PX = 8;
const SECTOR_SAMPLE_STEP_DEGREES = 3;
const ERROR_MIN_SPACE_PX = 64;
const VIEWPORT_MARGIN_PX = 12;

export function GameActions(props: Props) {
  return (
    <Suspense fallback={null}>
      <GameActionsContent {...props} />
    </Suspense>
  );
}

function GameActionsContent(props: Props) {
  const {
    actions,
    anchorElement,
    coin,
    coinIndex,
    gameId,
    onClose,
    onPassed,
    view,
  } = props;

  const { t } = useTranslation('features/game-actions', {
    keyPrefix: 'GameActions',
  });
  const wheelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<WheelPosition>(() =>
    getWheelPosition(anchorElement)
  );

  const {
    error: actionError,
    isPending: isActionPending,
    mutate: performAction,
  } = useGameActionMutation({
    coinIndex,
    gameId,
    onClose,
    onPassed,
    view,
  });

  useLayoutEffect(() => {
    function updatePosition(): void {
      setPosition(getWheelPosition(anchorElement));
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorElement]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        wheelRef.current?.contains(target) === true ||
        anchorElement.contains(target)
      ) {
        return;
      }

      onClose();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorElement, onClose]);

  return createPortal(
    <div
      className={classes.wheel}
      data-count={actions.length}
      data-error-placement={
        position.top + WHEEL_SIZE_PX + ERROR_MIN_SPACE_PX > window.innerHeight
          ? 'above'
          : 'below'
      }
      ref={wheelRef}
      style={{ left: position.left, top: position.top }}
    >
      {actions.map((action, index) => {
        const geometry = getSectorGeometry(index, actions.length);

        return (
          <button
            aria-label={t(action.id)}
            className={classes.action}
            data-action={action.id}
            disabled={!action.enabled || isActionPending}
            key={action.id}
            onClick={() => handleAction(action)}
            style={geometry.buttonStyle}
            title={action.enabled ? t(action.id) : t('unavailable')}
            type="button"
          >
            <span
              aria-hidden="true"
              className={classes.actionContent}
              data-icon-first={isIconFirst(index, actions.length)}
              style={geometry.contentStyle}
            >
              <span className={classes.actionIcon}>
                {renderActionIcon(action.id)}
              </span>
              <span className={classes.actionLabel}>
                {getActionLabel(action)}
              </span>
            </span>
          </button>
        );
      })}

      <svg
        aria-hidden="true"
        className={classes.dividers}
        viewBox={`0 0 ${WHEEL_SIZE_PX} ${WHEEL_SIZE_PX}`}
      >
        {actions.map((action, index) => {
          const sectorAngle = 360 / actions.length;
          const boundaryAngle =
            getSectorCenterAngle(index, actions.length) - sectorAngle / 2;
          const inner = getPoint(boundaryAngle, HUB_RADIUS_PX);
          const outer = getPoint(boundaryAngle, WHEEL_RADIUS_PX);

          return (
            <line
              key={action.id}
              x1={inner.x}
              x2={outer.x}
              y1={inner.y}
              y2={outer.y}
            />
          );
        })}
      </svg>

      <button
        aria-label={t('close')}
        className={classes.selectedCoin}
        onClick={onClose}
        type="button"
      >
        {renderCoin()}
      </button>

      {actionError && (
        <p className={classes.error} role="alert">
          {actionError}
        </p>
      )}
    </div>,
    document.body
  );

  function handleAction(action: GameWheelAction): void {
    if (!action.enabled) {
      return;
    }

    if (action.id === 'pass') {
      performAction();
    }
  }

  function renderCoin() {
    if (coin.kind === 'royal') {
      return <RoyalToken size="regular" />;
    }

    return <UnitToken color="brass" size="regular" unit={coin.unitId} />;
  }

  function getActionLabel(action: GameWheelAction): string {
    if (action.id === 'pass' && isActionPending) {
      return t('passing');
    }

    return t(action.id);
  }
}

function getWheelPosition(anchorElement: HTMLElement): WheelPosition {
  const anchorRect = anchorElement.getBoundingClientRect();
  const preferredLeft =
    anchorRect.left + anchorRect.width / 2 - WHEEL_SIZE_PX / 2;
  const preferredTop =
    anchorRect.top + anchorRect.height / 2 - WHEEL_SIZE_PX / 2;
  const maximumLeft = window.innerWidth - WHEEL_SIZE_PX - VIEWPORT_MARGIN_PX;
  const maximumTop = window.innerHeight - WHEEL_SIZE_PX - VIEWPORT_MARGIN_PX;

  return {
    left: Math.max(VIEWPORT_MARGIN_PX, Math.min(preferredLeft, maximumLeft)),
    top: Math.max(VIEWPORT_MARGIN_PX, Math.min(preferredTop, maximumTop)),
  };
}

function renderActionIcon(actionId: GameWheelAction['id']) {
  if (actionId === 'deploy') {
    return <img alt="" src={deployIcon} />;
  }

  if (actionId === 'recruit') {
    return <img alt="" src={recruitIcon} />;
  }

  if (actionId === 'reinforce') {
    return <Heart size="large" state="intact" />;
  }

  if (actionId === 'initiative') {
    return <InitiativeToken size="small" />;
  }

  if (actionId === 'maneuver') {
    return <img alt="" src={maneuverIcon} />;
  }

  return <img alt="" src={passIcon} />;
}

function getSectorGeometry(index: number, count: number): SectorGeometry {
  const sectorAngle = 360 / count;
  const startAngle = getSectorCenterAngle(index, count) - sectorAngle / 2;
  const sampleCount = Math.ceil(sectorAngle / SECTOR_SAMPLE_STEP_DEGREES);
  const points: WheelPoint[] = [{ x: WHEEL_RADIUS_PX, y: WHEEL_RADIUS_PX }];

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const angle = startAngle + (sectorAngle * sampleIndex) / sampleCount;
    points.push(getPoint(angle, WHEEL_RADIUS_PX));
  }

  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  const width = right - left;
  const height = bottom - top;
  const clipPoints = points.map((point) => {
    const x = ((point.x - left) / width) * 100;
    const y = ((point.y - top) / height) * 100;

    return `${x.toFixed(4)}% ${y.toFixed(4)}%`;
  });
  const contentPoint = getContentPoint(index, count);

  return {
    buttonStyle: {
      clipPath: `polygon(${clipPoints.join(', ')})`,
      height,
      left,
      top,
      width,
    },
    contentStyle: {
      left: contentPoint.x - left,
      top: contentPoint.y - top,
    },
  };
}

function getContentPoint(index: number, count: number): WheelPoint {
  const angle = getSectorCenterAngle(index, count);
  const horizontalMagnitude = Math.abs(Math.cos((angle * Math.PI) / 180));
  const maximumRadius =
    horizontalMagnitude === 0
      ? CONTENT_RADIUS_PX
      : (WHEEL_RADIUS_PX - LABEL_HALF_WIDTH_PX - HORIZONTAL_CONTENT_MARGIN_PX) /
        horizontalMagnitude;
  const point = getPoint(angle, Math.min(CONTENT_RADIUS_PX, maximumRadius));

  return point;
}

function getSectorCenterAngle(index: number, count: number): number {
  const sectorAngle = 360 / count;
  const firstCenterAngle = count % 2 === 0 ? -90 : -90 - sectorAngle / 2;

  return firstCenterAngle + index * sectorAngle;
}

function getPoint(angle: number, radius: number): WheelPoint {
  const radians = (angle * Math.PI) / 180;

  return {
    x: WHEEL_RADIUS_PX + radius * Math.cos(radians),
    y: WHEEL_RADIUS_PX + radius * Math.sin(radians),
  };
}

function isIconFirst(index: number, count: number): boolean {
  if (count === 6) {
    return index % 2 === 1;
  }

  if (count === 3) {
    return index === 2;
  }

  return Math.sin((getSectorCenterAngle(index, count) * Math.PI) / 180) > 0;
}
