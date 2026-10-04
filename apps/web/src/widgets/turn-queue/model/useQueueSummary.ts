import {
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { QueueStep } from './getQueueSteps';

interface OpenSummary {
  anchorElement: HTMLButtonElement;
  isTouch?: boolean;
  step: QueueStep;
  text: string;
}

interface SummaryPosition {
  left: number;
  maxHeight: number;
  maxWidth: number;
  top: number;
}

const SUMMARY_GAP_PX = 8;
const VIEWPORT_MARGIN_PX = 14;

export function useQueueSummary() {
  const summaryId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const openSummaryRef = useRef<OpenSummary | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [openSummary, setOpenSummary] = useState<OpenSummary | null>(null);
  const [summaryPosition, setSummaryPosition] =
    useState<SummaryPosition | null>(null);
  const hasSummaryPosition = summaryPosition !== null;

  useLayoutEffect(() => {
    if (openSummary === null) {
      return;
    }

    const anchorElement = openSummary.anchorElement;

    function updateSummaryPosition(): void {
      if (!anchorElement.isConnected) {
        openSummaryRef.current = null;
        setOpenSummary(null);
        return;
      }

      const anchorBounds = anchorElement.getBoundingClientRect();
      const queueBounds = anchorElement
        .closest('aside')
        ?.getBoundingClientRect();
      const left = (queueBounds?.right ?? anchorBounds.right) + SUMMARY_GAP_PX;
      const maxHeight = Math.max(
        0,
        window.innerHeight - VIEWPORT_MARGIN_PX * 2
      );
      const height = Math.min(summaryRef.current?.offsetHeight ?? 0, maxHeight);
      let preferredWidth = 304;

      if (window.innerWidth <= 620) {
        preferredWidth = 272;
      }

      setSummaryPosition({
        left,
        maxHeight,
        maxWidth: Math.max(
          0,
          Math.min(
            preferredWidth,
            window.innerWidth - left - VIEWPORT_MARGIN_PX
          )
        ),
        top: Math.max(
          VIEWPORT_MARGIN_PX,
          Math.min(
            anchorBounds.top,
            window.innerHeight - height - VIEWPORT_MARGIN_PX
          )
        ),
      });
    }

    updateSummaryPosition();
    const observer = new ResizeObserver(updateSummaryPosition);
    if (summaryRef.current !== null) {
      observer.observe(summaryRef.current);
    }

    window.addEventListener('resize', updateSummaryPosition);
    window.addEventListener('scroll', updateSummaryPosition, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSummaryPosition);
      window.removeEventListener('scroll', updateSummaryPosition, true);
    };
  }, [openSummary, hasSummaryPosition]);

  useEffect(() => {
    if (openSummary === null) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      if (
        target instanceof Node &&
        !openSummary?.anchorElement.contains(target) &&
        !summaryRef.current?.contains(target)
      ) {
        openSummaryRef.current = null;
        setOpenSummary(null);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
        openSummary?.anchorElement.focus();
        openSummaryRef.current = null;
        setOpenSummary(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openSummary]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return {
    closeHoveredSummary,
    closeSummary,
    dismissSummary,
    keepSummaryOpen,
    openSummary,
    showHoveredSummary,
    showSummary,
    summaryId,
    summaryPosition,
    summaryRef,
  };

  function showSummary(summary: OpenSummary): void {
    keepSummaryOpen();

    if (
      openSummaryRef.current?.anchorElement === summary.anchorElement &&
      openSummaryRef.current.isTouch
    ) {
      summary = { ...summary, isTouch: true };
    }

    openSummaryRef.current = summary;
    setOpenSummary(summary);
  }

  function showHoveredSummary(summary: OpenSummary): void {
    // Synthetic mouse events after touch must not replace the pinned preview.
    if (openSummaryRef.current?.isTouch) {
      return;
    }

    showSummary(summary);
  }

  function closeSummary(): void {
    keepSummaryOpen();
    openSummaryRef.current = null;
    setOpenSummary(null);
  }

  function dismissSummary(): void {
    openSummary?.anchorElement.focus();
    closeSummary();
  }

  function keepSummaryOpen(): void {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function closeHoveredSummary(): void {
    if (
      openSummaryRef.current?.isTouch ||
      window.matchMedia('(hover: none)').matches
    ) {
      return;
    }

    keepSummaryOpen();
    closeTimerRef.current = setTimeout(() => {
      if (
        openSummaryRef.current?.isTouch ||
        document.activeElement === openSummaryRef.current?.anchorElement ||
        summaryRef.current?.contains(document.activeElement)
      ) {
        return;
      }

      closeSummary();
    }, 180);
  }
}

export function getSummaryStyle(position: SummaryPosition): CSSProperties {
  return {
    left: position.left,
    maxHeight: position.maxHeight,
    width: position.maxWidth,
    top: position.top,
  };
}
