import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameView } from '@war-chest/game-engine';
import clsx from 'clsx';
import { createPortal } from 'react-dom';
import { UserAvatar } from '#/entities/user';
import draftBanIcon from '#/features/confirm-card-choice/assets/draftBanIcon.svg';
import deployIcon from '#/features/game-actions/assets/deployIcon.png';
import maneuverIcon from '#/features/game-actions/assets/maneuverIcon.png';
import passIcon from '#/features/game-actions/assets/passIcon.png';
import recruitIcon from '#/features/game-actions/assets/recruitIcon.png';
import { useTranslation } from '#/shared/i18n/useTranslation';
import draftPickIcon from '../assets/draftPickIcon.svg';
import VIEWING from '../assets/historyViewing.svg';
import QUEUE_SCROLL_BOUNDARY_DOWN from '../assets/queueScrollBoundaryDown.svg';
import QUEUE_SCROLL_BOUNDARY_UP from '../assets/queueScrollBoundaryUp.svg';
import QUEUE_SCROLL_CAN_SCROLL_DOWN from '../assets/queueScrollCanScrollDown.svg';
import QUEUE_SCROLL_CAN_SCROLL_UP from '../assets/queueScrollCanScrollUp.svg';
import type { QueueStep } from '../model/getQueueSteps';
import { useQueueDrag } from '../model/useQueueDrag';
import { useQueueScroll } from '../model/useQueueScroll';
import { getSummaryStyle, useQueueSummary } from '../model/useQueueSummary';
import { useTurnQueueHistory } from '../model/useTurnQueueHistory';
import { CurrentTurnAnchor } from './CurrentTurnAnchor';
import { TurnHistoryDetail } from './TurnHistoryDetail';
import classes from './TurnQueue.module.scss';

interface Props {
  gameId: string;
  playerProfiles: readonly LobbyGamePlayer[];
  view: GameView;
  userId?: string;
  history?: HistoryControls;
}

interface HistoryControls {
  error: string | null;
  moveNumber: number;
  sequence: number;
  status: 'idle' | 'review' | 'loading' | 'playing' | 'paused' | 'error';
  onPause(this: void): void;
  onPlay(this: void): void;
  onReturnToLive(this: void): void;
  onRetry(this: void): void;
  onSelect(this: void, sequence: number): void;
}

export function TurnQueue(props: Props) {
  const { gameId, history, playerProfiles, userId = '', view } = props;

  const { t } = useTranslation('widgets/turn-queue', {
    keyPrefix: 'TurnQueue',
  });

  // Load unit names with the rail so opening a card never suspends its focused avatar.
  useTranslation('entities/game-assets', { keyPrefix: 'units' });

  const {
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
  } = useQueueSummary();

  const {
    currentStepIndex: liveStepIndex,
    currentTurnKey,
    fetchPreviousSteps,
    hasPreviousSteps,
    historyItemsCount,
    isFetchingPreviousSteps,
    steps,
  } = useTurnQueueHistory({
    gameId,
    view,
  });
  const isHistorical =
    history !== undefined && history.sequence !== view.lastEventSequence;
  const showNow =
    isHistorical ||
    history?.status === 'loading' ||
    history?.status === 'error';
  const selectedStepIndex = steps.findIndex(
    (step) => isHistorical && step.sequence === history?.sequence
  );
  const currentStepIndex =
    selectedStepIndex < 0 ? liveStepIndex : selectedStepIndex;
  const scrollTurnKey = isHistorical
    ? `history-${history.sequence}`
    : currentTurnKey;
  const currentTurnNumber =
    view.status === 'finished' ? view.moveCount : view.moveCount + 1;
  let onViewSummary: ((sequence: number) => void) | undefined = undefined;

  if (history !== undefined) {
    onViewSummary = handleViewSummary;
  }
  const {
    canScrollDown,
    canScrollUp,
    handleBottomOrnamentClick,
    handleScroll,
    handleScrollUp,
    handleTouchMove,
    handleTouchStart,
    handleWheel,
    handleTopOrnamentClick,
    stepsRef,
    stopFollowingCurrent,
    virtualItems,
    virtualizer,
  } = useQueueScroll({
    currentStepIndex,
    currentTurnKey: scrollTurnKey,
    fetchPreviousSteps,
    hasPreviousSteps,
    historyItemsCount,
    isFetchingPreviousSteps,
    steps,
  });

  const {
    handleClickCapture,
    handleLostPointerCapture,
    handlePointerCancel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isDragging,
  } = useQueueDrag({
    onDragStart: closeSummary,
    onInteractionStart: stopFollowingCurrent,
    onScrollUp: handleScrollUp,
    scrollElementRef: stepsRef,
  });

  const topOrnament = canScrollUp
    ? QUEUE_SCROLL_CAN_SCROLL_UP
    : QUEUE_SCROLL_BOUNDARY_UP;
  const bottomOrnament = canScrollDown
    ? QUEUE_SCROLL_CAN_SCROLL_DOWN
    : QUEUE_SCROLL_BOUNDARY_DOWN;

  if (steps.length === 0) {
    return null;
  }

  return (
    <>
      <aside
        aria-label={t('label')}
        className={clsx(classes.queue, { [classes.withCurrent]: showNow })}
      >
        <button
          aria-label={t('loadPrevious')}
          className={classes.ornament}
          data-edge="top"
          disabled={!canScrollUp || isFetchingPreviousSteps}
          onClick={handleTopOrnamentClick}
          type="button"
        >
          <img alt="" src={topOrnament} />
        </button>

        <div
          className={clsx(classes.steps, { [classes.dragging]: isDragging })}
          onClickCapture={handleClickCapture}
          onDragStart={(event) => event.preventDefault()}
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

            if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) {
              handleScrollUp();
            }
          }}
          onLostPointerCapture={handleLostPointerCapture}
          onPointerCancel={handlePointerCancel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onScroll={handleScroll}
          onTouchMove={handleTouchMove}
          onTouchStart={handleTouchStart}
          onWheel={handleWheel}
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
              const isOpen = openSummary?.step.key === step.key;
              const isSelected =
                isHistorical && step.sequence === history?.sequence;
              let stepState: QueueStep['state'] | 'selected' = step.state;
              let ariaCurrent: 'step' | undefined = undefined;

              if (isSelected) {
                stepState = 'selected';
                ariaCurrent = 'step';
              }

              return (
                <div
                  aria-posinset={index + 1}
                  aria-setsize={steps.length}
                  className={classes.step}
                  data-state={stepState}
                  data-sequence={step.sequence}
                  key={virtualItem.key}
                  role="listitem"
                  style={{ top: virtualItem.start }}
                >
                  <button
                    aria-describedby={isOpen ? summaryId : undefined}
                    aria-expanded={isOpen}
                    aria-current={ariaCurrent}
                    aria-label={summary}
                    className={classes.avatarButton}
                    onPointerDown={(event) => {
                      if (event.pointerType === 'touch') {
                        showSummary({
                          anchorElement: event.currentTarget,
                          isTouch: true,
                          step,
                          text: summary,
                        });
                      }
                    }}
                    onBlur={(event) => {
                      if (
                        event.relatedTarget instanceof Node &&
                        summaryRef.current?.contains(event.relatedTarget)
                      ) {
                        return;
                      }

                      closeHoveredSummary();
                    }}
                    onClick={(event) => {
                      const isTouch =
                        window.matchMedia('(hover: none)').matches ||
                        (event.nativeEvent instanceof PointerEvent &&
                          event.nativeEvent.pointerType === 'touch');

                      showSummary({
                        anchorElement: event.currentTarget,
                        isTouch,
                        step,
                        text: summary,
                      });

                      if (
                        !isTouch &&
                        step.sequence !== undefined &&
                        history !== undefined
                      ) {
                        history.onSelect(step.sequence);
                      }
                    }}
                    onFocus={(event) => {
                      showSummary({
                        anchorElement: event.currentTarget,
                        step,
                        text: summary,
                      });
                    }}
                    onMouseEnter={(event) => {
                      if (isDragging) {
                        return;
                      }

                      showHoveredSummary({
                        anchorElement: event.currentTarget,
                        step,
                        text: summary,
                      });
                    }}
                    onMouseLeave={closeHoveredSummary}
                    title={summary}
                    type="button"
                  >
                    <UserAvatar size="medium" user={profile} />

                    {step.state === 'done' ? (
                      <span className={classes.actionBadge}>
                        <img alt="" src={getActionIcon(step.action)} />
                      </span>
                    ) : null}
                    {isSelected ? (
                      <span aria-hidden="true" className={classes.viewingBadge}>
                        <img alt="" src={VIEWING} />
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <button
          aria-label={t('scrollDown')}
          className={classes.ornament}
          data-edge="bottom"
          disabled={!canScrollDown}
          onClick={handleBottomOrnamentClick}
          type="button"
        >
          <img alt="" src={bottomOrnament} />
        </button>

        {showNow && history !== undefined ? (
          <CurrentTurnAnchor
            error={history.error}
            onPause={history.onPause}
            onPlay={history.onPlay}
            onReturnToLive={history.onReturnToLive}
            onRetry={history.onRetry}
            profile={getProfile(
              view.currentPlayerId ?? steps.at(-1)?.playerId ?? ''
            )}
            status={history.status}
            turnNumber={currentTurnNumber}
            viewedTurnNumber={history.moveNumber}
          />
        ) : null}
      </aside>

      {openSummary !== null && summaryPosition !== null
        ? createPortal(
            <div
              className={classes.summary}
              id={summaryId}
              onBlur={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  (summaryRef.current?.contains(event.relatedTarget) ||
                    openSummary.anchorElement.contains(event.relatedTarget))
                ) {
                  return;
                }
                closeHoveredSummary();
              }}
              onMouseEnter={keepSummaryOpen}
              onMouseLeave={closeHoveredSummary}
              ref={summaryRef}
              style={getSummaryStyle(summaryPosition)}
            >
              {openSummary.step.sequence === undefined ? (
                <span className={classes.simpleSummary} role="status">
                  {openSummary.text}
                </span>
              ) : (
                <TurnHistoryDetail
                  eventSequence={view.lastEventSequence}
                  gameId={gameId}
                  onClose={dismissSummary}
                  onView={onViewSummary}
                  profile={getProfile(openSummary.step.playerId)}
                  sequence={openSummary.step.sequence}
                  userId={userId}
                />
              )}
            </div>,
            document.body
          )
        : null}
    </>
  );

  function handleViewSummary(sequence: number): void {
    closeSummary();
    history?.onSelect(sequence);
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

function getActionIcon(action: QueueStep['action']): string {
  if (action === 'ban') {
    return draftBanIcon;
  }

  if (action === 'pass') {
    return passIcon;
  }

  if (action === 'deploy') {
    return deployIcon;
  }

  if (action === 'recruit') {
    return recruitIcon;
  }

  if (action === 'move' || action === 'tactic') {
    return maneuverIcon;
  }

  return draftPickIcon;
}
