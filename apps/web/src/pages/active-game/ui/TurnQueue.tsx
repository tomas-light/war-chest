import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  GameTurnHistoryItem,
  GameTurnHistoryQuery,
  GameTurnHistoryResponse,
  LobbyGamePlayer,
} from '@war-chest/api-contracts';
import type {
  CardSelection,
  GameView,
  GameViewPlayer,
} from '@war-chest/game-engine';
import {
  type CSSProperties,
  type UIEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { UserAvatar } from '#/entities/user';
import { createSelectedGameApi } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import QUEUE_SCROLL_BOUNDARY_DOWN from '../assets/queueScrollBoundaryDown.svg';
import QUEUE_SCROLL_BOUNDARY_UP from '../assets/queueScrollBoundaryUp.svg';
import QUEUE_SCROLL_CAN_SCROLL_DOWN from '../assets/queueScrollCanScrollDown.svg';
import QUEUE_SCROLL_CAN_SCROLL_UP from '../assets/queueScrollCanScrollUp.svg';
import classes from './TurnQueue.module.scss';

const QUEUE_STEP_SIZE_PX = 62;
const QUEUE_FOLLOW_PADDING_PX = QUEUE_STEP_SIZE_PX * 3;

interface Props {
  gameId: string;
  playerProfiles: readonly LobbyGamePlayer[];
  view: GameView;
}

interface QueueStep {
  action: 'ban' | 'pass' | 'pick' | 'turn';
  key: string;
  playerId: string;
  state: 'current' | 'done' | 'upcoming';
}

interface PendingTurn {
  playerId: string;
  sequence: number;
}

interface ObservedTurn {
  gameId: string;
  moveCount: number;
  playerId: string | null;
}

interface ScrollAvailability {
  down: boolean;
  up: boolean;
}

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

export function TurnQueue(props: Props) {
  const { gameId, playerProfiles, view } = props;

  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'TurnQueue',
  });

  const summaryId = useId();
  const [openSummary, setOpenSummary] = useState<OpenSummary | null>(null);
  const [summaryPosition, setSummaryPosition] =
    useState<SummaryPosition | null>(null);

  const [scrollAvailability, setScrollAvailability] =
    useState<ScrollAvailability>({ down: false, up: false });
  const [pendingTurns, setPendingTurns] = useState<PendingTurn[]>([]);

  const stepsRef = useRef<HTMLDivElement>(null);
  const observedTurnRef = useRef<ObservedTurn>({
    gameId,
    moveCount: view.moveCount,
    playerId: view.currentPlayerId,
  });
  const previousEventSequenceRef = useRef(view.lastEventSequence);
  const previousStatusRef = useRef(view.status);
  const previousTurnKeyRef = useRef<string | null>(null);
  const previousHistoryCountRef = useRef(0);
  const followCurrentRef = useRef(true);

  const initialPageSize = view.settings.format === 'duel' ? 2 : 4;
  const historyQuery = useInfiniteQuery<GameTurnHistoryResponse>({
    enabled: view.status === 'active',
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const gameApi = await createSelectedGameApi();
      const query: GameTurnHistoryQuery = {
        limit: initialPageSize,
      };

      if (typeof pageParam === 'number') {
        query.beforeSequence = pageParam;
      }

      return gameApi.listTurnHistory(gameId, query);
    },
    queryKey: ['game-turn-history', gameId, initialPageSize],
  });

  const historyItems = [
    ...(historyQuery.data?.pages.flatMap((page) => page.items) ?? []),
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
  const virtualizer = useVirtualizer({
    count: steps.length,
    estimateSize: () => QUEUE_STEP_SIZE_PX,
    getItemKey: (index) => steps[index]?.key ?? index,
    getScrollElement: () => stepsRef.current,
    overscan: 3,
    paddingEnd: QUEUE_FOLLOW_PADDING_PX,
  });
  const virtualItems = virtualizer.getVirtualItems();

  const canScrollUp = scrollAvailability.up || historyQuery.hasNextPage;
  const topOrnament = canScrollUp
    ? QUEUE_SCROLL_CAN_SCROLL_UP
    : QUEUE_SCROLL_BOUNDARY_UP;
  const bottomOrnament = scrollAvailability.down
    ? QUEUE_SCROLL_CAN_SCROLL_DOWN
    : QUEUE_SCROLL_BOUNDARY_DOWN;
  const refetchHistory = historyQuery.refetch;

  useLayoutEffect(() => {
    updateScrollAvailability();
  }, [steps.length]);

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
        ...currentTurns,
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
    setPendingTurns((currentTurns) => {
      const remainingTurns = currentTurns.filter(
        (turn) => turn.sequence > latestHistorySequence
      );

      if (remainingTurns.length === currentTurns.length) {
        return currentTurns;
      }

      return remainingTurns;
    });
  }, [latestHistorySequence]);

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
      previousHistoryCountRef.current !== historyItems.length;

    if (turnChanged) {
      followCurrentRef.current = true;
    }

    if (
      !isInitialPosition &&
      !turnChanged &&
      !(historyChanged && followCurrentRef.current)
    ) {
      previousTurnKeyRef.current = currentTurnKey;
      previousHistoryCountRef.current = historyItems.length;
      return;
    }

    const shouldAnimate =
      !isInitialPosition &&
      (turnChanged || historyChanged) &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frame = requestAnimationFrame(() => {
      previousTurnKeyRef.current = currentTurnKey;
      previousHistoryCountRef.current = historyItems.length;

      const targetScrollTop = Math.max(
        0,
        currentStepIndex * QUEUE_STEP_SIZE_PX -
          (stepsElement.clientHeight - QUEUE_STEP_SIZE_PX) / 2
      );

      if (shouldAnimate) {
        stepsElement.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth',
        });
      } else {
        stepsElement.scrollTo({
          top: targetScrollTop,
          behavior: 'auto',
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [currentStepIndex, currentTurnKey, historyItems.length]);

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

  if (steps.length === 0) {
    return null;
  }

  return (
    <>
      <aside aria-label={t('label')} className={classes.queue}>
        <button
          aria-label={t('loadPrevious')}
          className={classes.ornament}
          data-edge="top"
          disabled={!canScrollUp || historyQuery.isFetchingNextPage}
          onClick={handleTopOrnamentClick}
          type="button"
        >
          <img alt="" src={topOrnament} />
        </button>

        <div
          className={classes.steps}
          onKeyDown={(event) => {
            if (
              [
                'ArrowUp',
                'ArrowDown',
                'PageUp',
                'PageDown',
                'Home',
                'End',
              ].includes(event.key)
            ) {
              stopFollowingCurrent();
            }
          }}
          onPointerDown={stopFollowingCurrent}
          onScroll={handleScroll}
          onTouchStart={stopFollowingCurrent}
          onWheel={stopFollowingCurrent}
          ref={stepsRef}
          role="list"
          tabIndex={0}
        >
          <div
            className={classes.stepsContent}
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((virtualItem) => {
              const index = virtualItem.index;
              const step = steps[index];

              if (step === undefined) {
                return null;
              }

              const profile = getProfile(step.playerId);
              const summary = getSummary(step, profile.displayName);
              const isOpen = openSummary?.stepIndex === index;

              return (
                <div
                  aria-posinset={index + 1}
                  aria-setsize={steps.length}
                  className={classes.step}
                  data-state={step.state}
                  key={virtualItem.key}
                  role="listitem"
                  style={{ top: virtualItem.start }}
                >
                  <button
                    aria-describedby={isOpen ? summaryId : undefined}
                    aria-expanded={isOpen}
                    aria-label={summary}
                    className={classes.avatarButton}
                    onBlur={closeSummary}
                    onClick={(event) => {
                      showSummary({
                        anchorElement: event.currentTarget,
                        stepIndex: index,
                        text: summary,
                      });
                    }}
                    onFocus={(event) => {
                      showSummary({
                        anchorElement: event.currentTarget,
                        stepIndex: index,
                        text: summary,
                      });
                    }}
                    onMouseEnter={(event) => {
                      showSummary({
                        anchorElement: event.currentTarget,
                        stepIndex: index,
                        text: summary,
                      });
                    }}
                    onMouseLeave={(event) => {
                      closeHoveredSummary(event.currentTarget);
                    }}
                    title={summary}
                    type="button"
                  >
                    <UserAvatar size="medium" user={profile} />

                    {step.state === 'done' ? (
                      <span className={classes.actionBadge}>
                        {getActionSymbol(step.action)}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <span
          aria-hidden="true"
          className={classes.ornament}
          data-edge="bottom"
        >
          <img alt="" src={bottomOrnament} />
        </span>
      </aside>

      {openSummary !== null && summaryPosition !== null
        ? createPortal(
            <span
              className={classes.summary}
              id={summaryId}
              role="status"
              style={getSummaryStyle(summaryPosition)}
            >
              {openSummary.text}
            </span>,
            document.body
          )
        : null}
    </>
  );

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

  async function loadPreviousSteps(): Promise<void> {
    if (!historyQuery.hasNextPage || historyQuery.isFetchingNextPage) {
      return;
    }

    const previousScrollHeight = stepsRef.current?.scrollHeight ?? 0;
    await historyQuery.fetchNextPage();

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
      stepsElement.scrollBy({ top: -62 });
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

  function getProfile(playerId: string): LobbyGamePlayer {
    const profile = playerProfiles.find((item) => item.id === playerId);
    const player = view.players.find((item) => item.id === playerId);

    return (
      profile ?? {
        avatarVersion: null,
        displayName: t('playerFallback', {
          playerId: playerId.slice(0, 8),
        }),
        id: playerId,
        seat: player?.seat ?? 1,
        team: player?.team ?? 'white',
      }
    );
  }

  function getSummary(step: QueueStep, playerName: string): string {
    return t(`summary.${step.state}.${step.action}`, { playerName });
  }
}

function getQueueSteps(
  view: GameView,
  historyItems: readonly GameTurnHistoryItem[],
  pendingTurns: readonly PendingTurn[]
): QueueStep[] {
  if (view.status === 'cardSelection' && view.cardSelection !== null) {
    return getCardSelectionSteps(
      view.cardSelection,
      view.settings.cardSelectionMode === 'eliminationDraft'
    );
  }

  if (view.status === 'active') {
    return [
      ...historyItems.map((item) => ({
        action: item.action,
        key: `history-${item.sequence}`,
        playerId: item.playerId,
        state: 'done' as const,
      })),
      ...pendingTurns.map((turn) => ({
        action: 'turn' as const,
        key: `history-${turn.sequence}`,
        playerId: turn.playerId,
        state: 'done' as const,
      })),
      ...getActiveGameSteps(view),
    ];
  }

  return [];
}

function getCardSelectionSteps(
  selection: CardSelection,
  isElimination: boolean
): QueueStep[] {
  const actions: QueueStep['action'][] = [];

  if (isElimination) {
    actions.push(...selection.playerOrder.map(() => 'ban' as const));
  }

  const cardsPerPlayer = selection.playerOrder.length === 2 ? 4 : 3;
  const totalPicks = cardsPerPlayer * selection.playerOrder.length;
  const playerIds: string[] = [];

  if (isElimination) {
    playerIds.push(...selection.playerOrder);
  }

  for (let pickIndex = 0; pickIndex < totalPicks; pickIndex += 1) {
    const round = Math.floor(pickIndex / selection.playerOrder.length);
    const position = pickIndex % selection.playerOrder.length;
    const playerIndex =
      round % 2 === 0 ? position : selection.playerOrder.length - 1 - position;
    const playerId = selection.playerOrder[playerIndex];

    if (playerId !== undefined) {
      playerIds.push(playerId);
      actions.push('pick');
    }
  }

  const steps: QueueStep[] = playerIds.map((playerId, index) => ({
    action: actions[index] ?? 'pick',
    key: `selection-${index}`,
    playerId,
    state: getStepState(index, selection.choices.length),
  }));

  return limitFutureSteps(steps);
}

function getActiveGameSteps(view: GameView): QueueStep[] {
  const players = [...view.players].sort(comparePlayers);
  const currentPlayerIndex = players.findIndex(
    (player) => player.id === view.currentPlayerId
  );

  if (currentPlayerIndex < 0) {
    return [];
  }

  const remainingResources = players.map((player) => {
    const resources = view.battlefield?.playerResources.find(
      (item) => item.playerId === player.id
    );

    return {
      bagCount: resources?.bagCount ?? 0,
      discardCount: resources?.discard.length ?? 0,
      handCount: resources?.handCount ?? 0,
    };
  });
  const currentPlayer = players[currentPlayerIndex];

  if (currentPlayer === undefined) {
    return [];
  }

  const steps: QueueStep[] = [
    {
      action: 'turn',
      key: `active-${view.moveCount}`,
      playerId: currentPlayer.id,
      state: 'current',
    },
  ];
  const remainingTurnCount = remainingResources.reduce(
    (count, resources) => count + resources.handCount,
    0
  );
  let activePlayerIndex = currentPlayerIndex;

  for (let turn = 0; turn < remainingTurnCount; turn += 1) {
    const activeResources = remainingResources[activePlayerIndex];

    if (activeResources === undefined || activeResources.handCount === 0) {
      break;
    }

    activeResources.handCount -= 1;
    activeResources.discardCount += 1;

    if (remainingResources.every((resources) => resources.handCount === 0)) {
      const initiativePlayerIndex = players.findIndex(
        (player) => player.id === view.initiativePlayerId
      );

      if (initiativePlayerIndex < 0) {
        break;
      }

      for (let offset = 0; offset < players.length; offset += 1) {
        const playerIndex = (initiativePlayerIndex + offset) % players.length;
        const player = players[playerIndex];
        const resources = remainingResources[playerIndex];

        if (
          player === undefined ||
          resources === undefined ||
          (resources.discardCount === 0 && resources.bagCount === 0)
        ) {
          continue;
        }

        steps.push({
          action: 'turn',
          key: `active-${view.moveCount + steps.length}`,
          playerId: player.id,
          state: 'upcoming',
        });

        if (player.id === currentPlayer.id) {
          return steps;
        }
      }

      break;
    }

    for (let offset = 1; offset <= players.length; offset += 1) {
      const playerIndex = (activePlayerIndex + offset) % players.length;
      const player = players[playerIndex];
      const resources = remainingResources[playerIndex];

      if (player === undefined || resources?.handCount === 0) {
        continue;
      }

      steps.push({
        action: 'turn',
        key: `active-${view.moveCount + steps.length}`,
        playerId: player.id,
        state: 'upcoming',
      });

      if (player.id === currentPlayer.id) {
        return steps;
      }

      activePlayerIndex = playerIndex;
      break;
    }
  }

  return steps;
}

function limitFutureSteps(steps: QueueStep[]): QueueStep[] {
  const currentStepIndex = steps.findIndex((step) => step.state === 'current');

  if (currentStepIndex < 0) {
    return steps;
  }

  let lastVisibleIndex = currentStepIndex;

  for (let index = 0; index <= currentStepIndex; index += 1) {
    const playerId = steps[index]?.playerId;
    const nextOwnTurnIndex = steps.findIndex(
      (step, stepIndex) => stepIndex > index && step.playerId === playerId
    );

    if (nextOwnTurnIndex < 0) {
      return steps;
    }

    lastVisibleIndex = Math.max(lastVisibleIndex, nextOwnTurnIndex);
  }

  return steps.slice(0, lastVisibleIndex + 1);
}

function comparePlayers(first: GameViewPlayer, second: GameViewPlayer): number {
  if (first.seat !== second.seat) {
    return first.seat - second.seat;
  }

  return first.team.localeCompare(second.team);
}

function getStepState(
  index: number,
  completedCount: number
): QueueStep['state'] {
  if (index < completedCount) {
    return 'done';
  }

  if (index === completedCount) {
    return 'current';
  }

  return 'upcoming';
}

function getActionSymbol(action: QueueStep['action']): string {
  if (action === 'ban') {
    return '×';
  }

  if (action === 'pass') {
    return '↷';
  }

  return '✓';
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

function getSummaryStyle(position: SummaryPosition): CSSProperties {
  return {
    left: position.left,
    maxWidth: position.maxWidth,
    top: position.top,
  };
}
