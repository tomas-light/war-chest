import { useVirtualizer } from '@tanstack/react-virtual';
import { type UIEvent, useLayoutEffect, useRef, useState } from 'react';
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

const QUEUE_STEP_SIZE_PX = 62;
const QUEUE_FOLLOW_PADDING_PX = QUEUE_STEP_SIZE_PX * 3;

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

  const virtualizer = useVirtualizer({
    count: steps.length,
    estimateSize: () => QUEUE_STEP_SIZE_PX,
    getItemKey: (index) => steps[index]?.key ?? index,
    getScrollElement: () => stepsRef.current,
    overscan: 3,
    paddingEnd: QUEUE_FOLLOW_PADDING_PX,
  });
  const virtualItems = virtualizer.getVirtualItems();

  useLayoutEffect(() => {
    updateScrollAvailability();
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
    const frame = requestAnimationFrame(() => {
      previousTurnKeyRef.current = currentTurnKey;
      previousHistoryCountRef.current = historyItemsCount;

      const targetScrollTop = Math.max(
        0,
        currentStepIndex * QUEUE_STEP_SIZE_PX -
          (stepsElement.clientHeight - QUEUE_STEP_SIZE_PX) / 2
      );

      if (shouldAnimate) {
        stepsElement.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      } else {
        stepsElement.scrollTo({ top: targetScrollTop, behavior: 'auto' });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [currentStepIndex, currentTurnKey, historyItemsCount]);

  return {
    canScrollDown: scrollAvailability.down,
    canScrollUp: scrollAvailability.up || hasPreviousSteps,
    handleScroll,
    handleTopOrnamentClick,
    stepsRef,
    stopFollowingCurrent,
    virtualItems,
    virtualizer,
  };

  async function loadPreviousSteps(): Promise<void> {
    if (!hasPreviousSteps || isFetchingPreviousSteps) {
      return;
    }

    const previousScrollHeight = stepsRef.current?.scrollHeight ?? 0;
    await fetchPreviousSteps();

    requestAnimationFrame(() => {
      if (stepsRef.current !== null) {
        stepsRef.current.scrollTop +=
          stepsRef.current.scrollHeight - previousScrollHeight;
        updateScrollAvailability();
      }
    });
  }

  function handleScroll(event: UIEvent<HTMLDivElement>): void {
    updateScrollAvailability();

    if (event.currentTarget.scrollTop <= 8) {
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

  function stopFollowingCurrent(): void {
    followCurrentRef.current = false;
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
