import {
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

interface Options {
  onDragStart(this: void): void;
  onInteractionStart(this: void): void;
  onScrollUp(this: void): void;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}

interface MouseDrag {
  hasMoved: boolean;
  lastClientY: number;
  pointerId: number;
  startClientY: number;
}

interface ReleasePointerOptions {
  dragRef: RefObject<MouseDrag | null>;
  scrollElementRef: RefObject<HTMLDivElement | null>;
}

const DRAG_THRESHOLD_PX = 4;

export function useQueueDrag(options: Options) {
  const { onDragStart, onInteractionStart, onScrollUp, scrollElementRef } =
    options;

  const dragRef = useRef<MouseDrag | null>(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      releasePointer({ dragRef, scrollElementRef });
    };

    function handleWindowBlur(): void {
      suppressClickRef.current = dragRef.current?.hasMoved ?? false;
      releasePointer({ dragRef, scrollElementRef });
      setIsDragging(false);
    }
  }, [scrollElementRef]);

  return {
    handleClickCapture,
    handleLostPointerCapture,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDragging,
  };

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    suppressClickRef.current = false;
    onInteractionStart();

    if (event.pointerType !== 'mouse' || event.button !== 0) {
      return;
    }

    dragRef.current = {
      hasMoved: false,
      lastClientY: event.clientY,
      pointerId: event.pointerId,
      startClientY: event.clientY,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    const scrollElement = scrollElementRef.current;

    if (
      drag === null ||
      scrollElement === null ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    if (event.buttons !== 1) {
      cancelDrag();
      return;
    }

    if (!drag.hasMoved) {
      if (Math.abs(event.clientY - drag.startClientY) < DRAG_THRESHOLD_PX) {
        return;
      }

      drag.hasMoved = true;
      scrollElement.setPointerCapture(event.pointerId);
      setIsDragging(true);
      onDragStart();
    }

    event.preventDefault();
    scrollElement.scrollTop += drag.lastClientY - event.clientY;
    if (event.clientY > drag.lastClientY) {
      onScrollUp();
    }

    drag.lastClientY = event.clientY;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === event.pointerId) {
      cancelDrag();
    }
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === event.pointerId) {
      cancelDrag();
    }
  }

  function handleLostPointerCapture(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId === event.pointerId) {
      cancelDrag();
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>): void {
    if (suppressClickRef.current && event.detail !== 0) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function cancelDrag(): void {
    suppressClickRef.current = dragRef.current?.hasMoved ?? false;
    releasePointer({ dragRef, scrollElementRef });
    setIsDragging(false);
  }
}

function releasePointer(options: ReleasePointerOptions): void {
  const { dragRef, scrollElementRef } = options;

  const drag = dragRef.current;
  const scrollElement = scrollElementRef.current;
  dragRef.current = null;

  if (drag !== null && scrollElement?.hasPointerCapture(drag.pointerId)) {
    scrollElement.releasePointerCapture(drag.pointerId);
  }
}
