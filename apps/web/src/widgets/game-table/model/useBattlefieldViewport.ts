import { type PointerEvent, useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Pan {
  x: number;
  y: number;
}

interface Gesture {
  distance: number;
  pan: Pan;
  scale: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.25;
const DESKTOP_MEDIA_QUERY = '(min-width: 621px)';

export function useBattlefieldViewport() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);

  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);

    desktopMediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      desktopMediaQuery.removeEventListener('change', handleViewportChange);
    };

    function handleViewportChange(event: MediaQueryListEvent): void {
      if (!event.matches) {
        return;
      }

      pointersRef.current.clear();
      gestureRef.current = null;
      setPan({ x: 0, y: 0 });
      setScale(MIN_SCALE);
    }
  }, []);

  return {
    canZoomIn: scale < MAX_SCALE,
    canZoomOut: scale > MIN_SCALE,
    handlePointerDown,
    handlePointerEnd,
    handlePointerMove,
    pan,
    resetView,
    scale,
    viewportRef,
    zoomIn,
    zoomOut,
  };

  function zoomIn(): void {
    changeScale(SCALE_STEP);
  }

  function zoomOut(): void {
    changeScale(-SCALE_STEP);
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

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    startGesture();
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
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

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>): void {
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

function getDistance(firstPoint: Point, secondPoint: Point): number {
  return Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
