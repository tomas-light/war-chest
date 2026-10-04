import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type TouchEvent,
  type UIEvent,
  type WheelEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { QueueStep } from './getQueueSteps';
import type { useTurnQueueHistory } from './useTurnQueueHistory';

interface Options {
  currentStepIndex: number;
  currentTurnKey: string;
  fetchPreviousSteps: ReturnType<
    typeof useTurnQueueHistory
  >['fetchPreviousSteps'];
  hasPreviousSteps: boolean;
  historyItemsCount: number;
  isFetchingPreviousSteps: boolean;
  steps: readonly QueueStep[];
}

interface ScrollAvailability {
  down: boolean;
  up: boolean;
}

const QUEUE_AVATAR_SIZE_PX = 48;
const QUEUE_STEP_GAP_PX = 14;
const QUEUE_STEP_SIZE_PX = QUEUE_AVATAR_SIZE_PX + QUEUE_STEP_GAP_PX;

export function useQueueScroll(options: Options) {
  const {
    currentStepIndex,
    currentTurnKey,
    fetchPreviousSteps,
    hasPreviousSteps,
    historyItemsCount,
    isFetchingPreviousSteps,
    steps,
  } = options;

  const [scrollAvailability, setScrollAvailability] =
    useState<ScrollAvailability>({ down: false, up: false });
  const stepsRef = useRef<HTMLDivElement>(null);
  const previousTurnKeyRef = useRef<string | null>(null);
  const previousHistoryCountRef = useRef(0);
  const followCurrentRef = useRef(true);
  const followFrameRef = useRef<number | null>(null);
  const isLoadingPreviousRef = useRef(false);
  const previousTouchYRef = useRef<number | null>(null);

  const virtualizer = useVirtualizer({
    count: steps.length,
    estimateSize: () => QUEUE_AVATAR_SIZE_PX,
    gap: QUEUE_STEP_GAP_PX,
    getItemKey: (index) => steps[index]?.key ?? index,
    getScrollElement: () => stepsRef.current,
    overscan: 3,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    const stepsElement = stepsRef.current;

    if (stepsElement === null) {
      return;
    }

    updateScrollAvailability();
    const observer = new ResizeObserver(updateScrollAvailability);
    observer.observe(stepsElement);

    if (stepsElement.firstElementChild !== null) {
      observer.observe(stepsElement.firstElementChild);
    }

    return () => observer.disconnect();
  }, [steps.length]);

  useLayoutEffect(() => {
    const stepsElement = stepsRef.current;

    if (currentStepIndex < 0 || stepsElement === null) {
      return;
    }

    const previousTurnKey = previousTurnKeyRef.current;
    const isInitialPosition = previousTurnKey === null;
    const turnChanged =
      previousTurnKey !== null && previousTurnKey !== currentTurnKey;
    const historyChanged =
      previousHistoryCountRef.current !== historyItemsCount;

    if (turnChanged) {
      followCurrentRef.current = true;
    }

    if (
      !isInitialPosition &&
      !turnChanged &&
      !(historyChanged && followCurrentRef.current)
    ) {
      previousTurnKeyRef.current = currentTurnKey;
      previousHistoryCountRef.current = historyItemsCount;
      return;
    }

    const shouldAnimate =
      !isInitialPosition &&
      (turnChanged || historyChanged) &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    previousTurnKeyRef.current = currentTurnKey;
    previousHistoryCountRef.current = historyItemsCount;

    const frame = requestAnimationFrame(() => {
      followFrameRef.current = null;

      const targetScrollTop = Math.max(
        0,
        currentStepIndex * QUEUE_STEP_SIZE_PX -
          (stepsElement.clientHeight - QUEUE_AVATAR_SIZE_PX) / 2
      );

      if (shouldAnimate) {
        stepsElement.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      } else {
        stepsElement.scrollTo({ top: targetScrollTop, behavior: 'auto' });
      }
    });
    followFrameRef.current = frame;

    return () => {
      cancelAnimationFrame(frame);

      if (followFrameRef.current === frame) {
        followFrameRef.current = null;
      }
    };
  }, [currentStepIndex, currentTurnKey, historyItemsCount]);

  return {
    canScrollDown: scrollAvailability.down,
    canScrollUp: scrollAvailability.up || hasPreviousSteps,
    handleScroll,
    handleScrollUp,
    handleTouchMove,
    handleTouchStart,
    handleWheel,
    handleBottomOrnamentClick,
    handleTopOrnamentClick,
    stepsRef,
    stopFollowingCurrent,
    virtualItems,
    virtualizer,
  };

  async function loadPreviousSteps(): Promise<void> {
    if (
      !hasPreviousSteps ||
      isFetchingPreviousSteps ||
      isLoadingPreviousRef.current
    ) {
      return;
    }

    isLoadingPreviousRef.current = true;
    const previousScrollHeight = stepsRef.current?.scrollHeight ?? 0;

    try {
      await fetchPreviousSteps();

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          if (stepsRef.current !== null) {
            stepsRef.current.scrollTop +=
              stepsRef.current.scrollHeight - previousScrollHeight;
            updateScrollAvailability();
          }

          resolve();
        });
      });
    } finally {
      isLoadingPreviousRef.current = false;
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>): void {
    updateScrollAvailability();

    // Following a turn must not interrupt its own animation or fetch older pages.
    if (event.currentTarget.scrollTop <= 8 && !followCurrentRef.current) {
      void loadPreviousSteps();
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>): void {
    stopFollowingCurrent();

    if (event.deltaY < 0) {
      handleScrollUp();
    }
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>): void {
    const touch = event.touches.item(0);
    previousTouchYRef.current = touch?.clientY ?? null;
    stopFollowingCurrent();
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>): void {
    const touch = event.touches.item(0);
    const previousTouchY = previousTouchYRef.current;
    previousTouchYRef.current = touch?.clientY ?? null;

    if (
      touch !== null &&
      previousTouchY !== null &&
      touch.clientY > previousTouchY
    ) {
      handleScrollUp();
    }
  }

  function handleScrollUp(): void {
    if (stepsRef.current !== null && stepsRef.current.scrollTop <= 8) {
      stopFollowingCurrent();
      void loadPreviousSteps();
    }
  }

  function handleTopOrnamentClick(): void {
    stopFollowingCurrent();

    const stepsElement = stepsRef.current;

    if (stepsElement !== null && stepsElement.scrollTop > 8) {
      stepsElement.scrollBy({ top: -QUEUE_STEP_SIZE_PX });
      return;
    }

    void loadPreviousSteps();
  }

  function handleBottomOrnamentClick(): void {
    stopFollowingCurrent();
    stepsRef.current?.scrollBy({ top: QUEUE_STEP_SIZE_PX });
  }

  function stopFollowingCurrent(): void {
    followCurrentRef.current = false;

    if (followFrameRef.current !== null) {
      cancelAnimationFrame(followFrameRef.current);
      followFrameRef.current = null;
    }

    const stepsElement = stepsRef.current;

    if (stepsElement !== null) {
      stepsElement.scrollTo({ top: stepsElement.scrollTop, behavior: 'auto' });
    }
  }

  function updateScrollAvailability(): void {
    const stepsElement = stepsRef.current;

    if (stepsElement === null) {
      return;
    }

    const maximumScrollTop =
      stepsElement.scrollHeight - stepsElement.clientHeight;
    const nextAvailability = {
      down: stepsElement.scrollTop < maximumScrollTop - 1,
      up: stepsElement.scrollTop > 1,
    };

    setScrollAvailability((currentAvailability) => {
      if (
        currentAvailability.down === nextAvailability.down &&
        currentAvailability.up === nextAvailability.up
      ) {
        return currentAvailability;
      }

      return nextAvailability;
    });
  }
}
