import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameView } from '@war-chest/game-engine';
import { createPortal } from 'react-dom';
import { UserAvatar } from '#/entities/user';
import draftBanIcon from '#/features/confirm-card-choice/assets/draftBanIcon.svg';
import deployIcon from '#/features/game-actions/assets/deployIcon.png';
import maneuverIcon from '#/features/game-actions/assets/maneuverIcon.png';
import passIcon from '#/features/game-actions/assets/passIcon.png';
import recruitIcon from '#/features/game-actions/assets/recruitIcon.png';
import { useTranslation } from '#/shared/i18n/useTranslation';
import draftPickIcon from '../assets/draftPickIcon.svg';
import QUEUE_SCROLL_BOUNDARY_DOWN from '../assets/queueScrollBoundaryDown.svg';
import QUEUE_SCROLL_BOUNDARY_UP from '../assets/queueScrollBoundaryUp.svg';
import QUEUE_SCROLL_CAN_SCROLL_DOWN from '../assets/queueScrollCanScrollDown.svg';
import QUEUE_SCROLL_CAN_SCROLL_UP from '../assets/queueScrollCanScrollUp.svg';
import type { QueueStep } from '../model/getQueueSteps';
import { useQueueScroll } from '../model/useQueueScroll';
import { getSummaryStyle, useQueueSummary } from '../model/useQueueSummary';
import { useTurnQueueHistory } from '../model/useTurnQueueHistory';
import classes from './TurnQueue.module.scss';

interface Props {
  gameId: string;
  playerProfiles: readonly LobbyGamePlayer[];
  view: GameView;
}

export function TurnQueue(props: Props) {
  const { gameId, playerProfiles, view } = props;

  const { t } = useTranslation('widgets/turn-queue', {
    keyPrefix: 'TurnQueue',
  });

  const {
    closeHoveredSummary,
    closeSummary,
    openSummary,
    showSummary,
    summaryId,
    summaryPosition,
  } = useQueueSummary();

  const {
    currentStepIndex,
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
  const {
    canScrollDown,
    canScrollUp,
    handleScroll,
    handleTopOrnamentClick,
    stepsRef,
    stopFollowingCurrent,
    virtualItems,
    virtualizer,
  } = useQueueScroll({
    currentStepIndex,
    currentTurnKey,
    fetchPreviousSteps,
    hasPreviousSteps,
    historyItemsCount,
    isFetchingPreviousSteps,
    steps,
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
      <aside aria-label={t('label')} className={classes.queue}>
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
                        <img alt="" src={getActionIcon(step.action)} />
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

  if (action === 'move') {
    return maneuverIcon;
  }

  return draftPickIcon;
}
