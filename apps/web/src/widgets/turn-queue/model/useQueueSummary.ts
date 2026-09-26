import {
  type CSSProperties,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
} from 'react';

interface OpenSummary {
  anchorElement: HTMLButtonElement;
  stepIndex: number;
  text: string;
}

interface SummaryPosition {
  left: number;
  maxWidth: number;
  top: number;
}

const SUMMARY_GAP_PX = 10;
const SUMMARY_MAX_WIDTH_PX = 280;
const VIEWPORT_MARGIN_PX = 12;

export function useQueueSummary() {
  const summaryId = useId();
  const [openSummary, setOpenSummary] = useState<OpenSummary | null>(null);
  const [summaryPosition, setSummaryPosition] =
    useState<SummaryPosition | null>(null);

  useLayoutEffect(() => {
    if (openSummary === null) {
      return;
    }

    const anchorElement = openSummary.anchorElement;

    function updateSummaryPosition(): void {
      if (!anchorElement.isConnected) {
        setOpenSummary(null);
        return;
      }

      setSummaryPosition(getSummaryPosition(anchorElement));
    }

    updateSummaryPosition();
    window.addEventListener('resize', updateSummaryPosition);
    window.addEventListener('scroll', updateSummaryPosition, true);

    return () => {
      window.removeEventListener('resize', updateSummaryPosition);
      window.removeEventListener('scroll', updateSummaryPosition, true);
    };
  }, [openSummary]);

  useEffect(() => {
    if (openSummary === null) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (!openSummary?.anchorElement.contains(target)) {
        setOpenSummary(null);
      }
    }

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === 'Escape') {
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

  return {
    closeHoveredSummary,
    closeSummary,
    openSummary,
    showSummary,
    summaryId,
    summaryPosition,
  };

  function showSummary(summary: OpenSummary): void {
    setOpenSummary(summary);
  }

  function closeSummary(): void {
    setOpenSummary(null);
  }

  function closeHoveredSummary(anchorElement: HTMLButtonElement): void {
    if (document.activeElement === anchorElement) {
      return;
    }

    setOpenSummary((currentSummary) => {
      if (currentSummary?.anchorElement === anchorElement) {
        return null;
      }

      return currentSummary;
    });
  }
}

export function getSummaryStyle(position: SummaryPosition): CSSProperties {
  return {
    left: position.left,
    maxWidth: position.maxWidth,
    top: position.top,
  };
}

function getSummaryPosition(anchorElement: HTMLButtonElement): SummaryPosition {
  const anchorBounds = anchorElement.getBoundingClientRect();
  const left = anchorBounds.right + SUMMARY_GAP_PX;
  const availableWidth = window.innerWidth - left - VIEWPORT_MARGIN_PX;

  return {
    left,
    maxWidth: Math.min(SUMMARY_MAX_WIDTH_PX, availableWidth),
    top: anchorBounds.top + anchorBounds.height / 2,
  };
}
