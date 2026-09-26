import type { GameView } from '@war-chest/game-engine';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameTurnHistoryQuery } from '#/entities/game';
import { type PendingTurn, getQueueSteps } from './getQueueSteps';

interface Input {
  gameId: string;
  view: GameView;
}

interface ObservedTurn {
  gameId: string;
  moveCount: number;
  playerId: string | null;
}

export function useTurnQueueHistory(input: Input) {
  const { gameId, view } = input;

  const [pendingTurns, setPendingTurns] = useState<PendingTurn[]>([]);
  const observedTurnRef = useRef<ObservedTurn>({
    gameId,
    moveCount: view.moveCount,
    playerId: view.currentPlayerId,
  });
  const previousEventSequenceRef = useRef(view.lastEventSequence);
  const previousStatusRef = useRef(view.status);

  const initialPageSize = view.settings.format === 'duel' ? 2 : 4;
  const {
    data: historyData,
    fetchNextPage: fetchPreviousSteps,
    hasNextPage: hasPreviousSteps,
    isFetchingNextPage: isFetchingPreviousSteps,
    refetch: refetchHistory,
  } = useGameTurnHistoryQuery({
    enabled: view.status === 'active',
    gameId,
    initialPageSize,
  });

  const historyItems = [
    ...(historyData?.pages.flatMap((page) => page.items) ?? []),
  ].sort((first, second) => first.sequence - second.sequence);
  const latestHistorySequence = historyItems.at(-1)?.sequence ?? 0;
  const visiblePendingTurns = pendingTurns.filter(
    (turn) => turn.sequence > latestHistorySequence
  );
  const steps = getQueueSteps(view, historyItems, visiblePendingTurns);
  const currentStepIndex = steps.findIndex((step) => step.state === 'current');
  const currentTurnKey =
    view.status === 'cardSelection'
      ? `selection-${view.cardSelection?.choices.length ?? 0}`
      : `active-${view.currentPlayerId ?? 'none'}-${view.moveCount}`;

  useLayoutEffect(() => {
    const previousTurn = observedTurnRef.current;
    const previousPlayerId = previousTurn.playerId;

    observedTurnRef.current = {
      gameId,
      moveCount: view.moveCount,
      playerId: view.currentPlayerId,
    };

    if (previousTurn.gameId !== gameId) {
      setPendingTurns([]);
      return;
    }

    if (
      view.status === 'active' &&
      view.moveCount === previousTurn.moveCount + 1 &&
      previousPlayerId !== null &&
      latestHistorySequence < view.lastEventSequence
    ) {
      setPendingTurns((currentTurns) => [
        ...currentTurns.filter((turn) => turn.sequence > latestHistorySequence),
        {
          playerId: previousPlayerId,
          sequence: view.lastEventSequence,
        },
      ]);
    }
  }, [
    gameId,
    latestHistorySequence,
    view.currentPlayerId,
    view.lastEventSequence,
    view.moveCount,
    view.status,
  ]);

  useEffect(() => {
    const wasActive = previousStatusRef.current === 'active';
    const eventSequenceChanged =
      previousEventSequenceRef.current !== view.lastEventSequence;

    previousStatusRef.current = view.status;
    previousEventSequenceRef.current = view.lastEventSequence;

    if (wasActive && view.status === 'active' && eventSequenceChanged) {
      void refetchHistory();
    }
  }, [refetchHistory, view.lastEventSequence, view.status]);

  return {
    currentStepIndex,
    currentTurnKey,
    fetchPreviousSteps,
    hasPreviousSteps,
    historyItemsCount: historyItems.length,
    isFetchingPreviousSteps,
    steps,
  };
}
