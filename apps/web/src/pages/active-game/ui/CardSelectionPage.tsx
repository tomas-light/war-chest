import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import {
  type CardSelection,
  type GameView,
  type UnitId,
  getCurrentCardSelectionPlayer,
} from '@war-chest/game-engine';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import { UserAvatar } from '#/entities/user';
import { AutoCompleteCardSelection } from '#/features/complete-card-selection';
import { ConfirmCardChoiceButton } from '#/features/confirm-card-choice';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { CardSelectionCard } from './CardSelectionCard';
import { CardSelectionPlayer } from './CardSelectionPlayer';
import classes from './CardSelectionPage.module.scss';

interface Props {
  gameId: string;
  isConnectionReady: boolean;
  onConfirmed(this: void, view: GameView): void;
  playerProfiles: readonly LobbyGamePlayer[];
  userId: string;
  view: GameView;
}

export function CardSelectionPage(props: Props) {
  const {
    gameId,
    isConnectionReady,
    onConfirmed,
    playerProfiles,
    userId,
    view,
  } = props;

  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'CardSelectionPage',
  });

  const [candidate, setCandidate] = useState<{
    unitId: UnitId;
    version: number;
  } | null>(null);

  const selection = requireCardSelection(view.cardSelection);
  const currentPlayerId = getCurrentCardSelectionPlayer(selection);

  const isCurrentPlayer = currentPlayerId === userId;
  const isBanning = selection.phase === 'banning';
  const isComplete = selection.phase === 'complete';
  const isTeam = view.settings.format === 'team';
  const isElimination = view.settings.cardSelectionMode === 'eliminationDraft';

  const cardsPerPlayer = isTeam ? 3 : 4;
  const totalPicks = cardsPerPlayer * selection.playerOrder.length;
  const pickCount = selection.choices.filter(
    (choice) => choice.action === 'pick'
  ).length;
  const banCount = selection.choices.length - pickCount;

  const isLastManualPick = !isBanning && pickCount === totalPicks - 2;
  const isReverse =
    !isBanning &&
    Math.floor(pickCount / selection.playerOrder.length) % 2 === 1;

  const currentNumber =
    selection.playerOrder.findIndex((id) => id === currentPlayerId) + 1;
  const nextPickIndex = pickCount + 1;
  const nextRound = Math.floor(nextPickIndex / selection.playerOrder.length);
  const nextPosition = nextPickIndex % selection.playerOrder.length;
  const nextPlayerId = isBanning
    ? (selection.playerOrder[banCount + 1] ?? selection.playerOrder[0])
    : selection.playerOrder[
        nextRound % 2 === 0
          ? nextPosition
          : selection.playerOrder.length - 1 - nextPosition
      ];
  const nextNumber =
    selection.playerOrder.findIndex((id) => id === nextPlayerId) + 1;

  const candidateUnitId =
    candidate?.version === view.lastEventSequence && isCurrentPlayer
      ? candidate.unitId
      : null;
  const canChoose = !isComplete && isCurrentPlayer && isConnectionReady;
  const isParticipant = view.players.some(
    (player) => player.id === userId && player.presence === 'connected'
  );

  const currentUser = view.players.find((player) => player.id === userId);

  // Resume saved selections created before the last card became automatic.
  if (isComplete || (!isBanning && pickCount === totalPicks - 1)) {
    return (
      <section className={classes.selection}>
        <AutoCompleteCardSelection
          disabled={!isConnectionReady || !isParticipant}
          gameId={gameId}
          onCompleted={onConfirmed}
          view={view}
        />
      </section>
    );
  }

  return (
    <section
      className={clsx(classes.selection, { [classes.teamSelection]: isTeam })}
    >
      <div className={classes.heading}>
        <p className={classes.eyebrow}>{getEyebrow()}</p>
        <h1 className={classes.title}>{t('title')}</h1>
        <p className={classes.description}>{getDescription()}</p>
        <div className={classes.turn} role="status">
          <p className={classes.turnTitle}>
            <span className={classes.desktopTurn}>{getTurnTitle()}</span>
            {isTeam ? (
              <span className={classes.mobileTurn}>{getMobileTurnTitle()}</span>
            ) : null}
          </p>
          {isTeam ? (
            <p className={classes.turnHint}>{getTeamTurnHint()}</p>
          ) : null}
        </div>
        {isTeam ? (
          <div className={classes.compactPlayers}>
            {selection.playerOrder.map((playerId, index) => {
              const profile = getProfile(playerId);
              const compactName =
                playerId === userId ? t('you') : profile.displayName;
              const compactCountLabel =
                playerId === currentPlayerId
                  ? 'compactCurrentCount'
                  : 'compactCount';

              return (
                <Fragment key={playerId}>
                  {index === 0 ? null : (
                    <span
                      aria-hidden="true"
                      className={classes.connector}
                      data-reverse={isReverse}
                    >
                      <span className={classes.arrow} />
                    </span>
                  )}
                  <div
                    className={classes.compactPlayer}
                    data-current={playerId === currentPlayerId}
                  >
                    <strong className={classes.compactNumber}>
                      {index + 1}
                    </strong>
                    <UserAvatar size="small" user={profile} />
                    <span className={classes.compactName}>{compactName}</span>
                    <span className={classes.compactCount}>
                      {t(compactCountLabel, {
                        count: getPicks(playerId).length,
                        total: cardsPerPlayer,
                      })}
                    </span>
                  </div>
                </Fragment>
              );
            })}
          </div>
        ) : null}
        <div className={classes.players}>
          {selection.playerOrder.map((playerId, index) => (
            <Fragment key={playerId}>
              {!isTeam || index === 0 ? null : (
                <span
                  aria-hidden="true"
                  className={classes.connector}
                  data-reverse={isReverse}
                >
                  <span className={classes.arrow} />
                </span>
              )}
              <CardSelectionPlayer
                banUnitId={
                  selection.choices.find(
                    (choice) =>
                      choice.playerId === playerId && choice.action === 'ban'
                  )?.unitId
                }
                cardsPerPlayer={cardsPerPlayer}
                className={classes.player}
                isCurrent={playerId === currentPlayerId}
                isElimination={isElimination}
                isTeam={isTeam}
                isYou={playerId === userId}
                number={index + 1}
                picks={getPicks(playerId)}
                profile={getProfile(playerId)}
              />
            </Fragment>
          ))}
        </div>
        {isTeam ? (
          <div className={classes.nextTurn}>
            <p className={classes.nextTitle}>{getNextTurnTitle()}</p>
            <p className={classes.sequence}>{getNextTurnHint()}</p>
          </div>
        ) : (
          <p className={classes.sequence}>{getDuelSequence()}</p>
        )}
      </div>
      <div
        className={classes.cards}
        data-card-count={selection.pool.length}
        data-disabled={!isConnectionReady}
      >
        {selection.pool.map((unitId) => {
          const choice = selection.choices.find(
            (item) => item.unitId === unitId
          );
          const owner = view.players.find(
            (player) => player.id === choice?.playerId
          );
          const ownerProfile =
            choice === undefined ? undefined : getProfile(choice.playerId);

          return (
            <CardSelectionCard
              action={choice?.action}
              disabled={!canChoose || choice !== undefined}
              isAlly={
                currentUser !== undefined && owner?.team === currentUser.team
              }
              isCandidate={candidateUnitId === unitId}
              isOwn={choice?.playerId === userId}
              key={unitId}
              onSelect={() =>
                setCandidate({ unitId, version: view.lastEventSequence })
              }
              owner={ownerProfile}
              unitId={unitId}
            />
          );
        })}
      </div>
      <div className={classes.actions}>
        <p className={classes.actionHint}>{getActionHint()}</p>
        {isLastManualPick ? (
          <p className={classes.actionHint}>{t('automaticTransitionHint')}</p>
        ) : null}
        <ConfirmCardChoiceButton
          disabled={candidateUnitId === null || !canChoose}
          gameId={gameId}
          onConfirmed={handleConfirmed}
          unitId={candidateUnitId}
          view={view}
        />
      </div>
    </section>
  );

  function handleConfirmed(nextView: GameView): void {
    setCandidate(null);
    onConfirmed(nextView);
  }

  function getPicks(playerId: string): UnitId[] {
    return selection.choices
      .filter(
        (choice) => choice.playerId === playerId && choice.action === 'pick'
      )
      .map((choice) => choice.unitId);
  }

  function getProfile(playerId: string | undefined): LobbyGamePlayer {
    const profile = playerProfiles.find((player) => player.id === playerId);
    const player = view.players.find((item) => item.id === playerId);
    return (
      profile ?? {
        avatarVersion: null,
        displayName: t('playerFallback', {
          playerId: playerId?.slice(0, 8) ?? '—',
        }),
        id: playerId ?? '',
        seat: player?.seat ?? 1,
        team: player?.team ?? 'white',
      }
    );
  }

  function getDescription(): string {
    if (isTeam) {
      if (!isElimination) {
        return t('teamDescription');
      }

      if (isBanning) {
        return t('teamBanDescription');
      }

      return t('teamEliminationDescription');
    }

    if (isBanning) {
      return t('duelBanDescription', {
        number: banCount + 1,
        total: selection.pool.length,
      });
    }

    if (isElimination) {
      return t('duelEliminationDescription', {
        total: selection.pool.length,
      });
    }

    return t('duelDescription', { total: selection.pool.length });
  }

  function getTurnTitle(): string {
    if (isTeam) {
      if (isBanning) {
        return t('teamBanTurn', {
          number: banCount + 1,
          player: currentNumber,
        });
      }

      if (isReverse) {
        return t('teamReverseTurn', {
          number: pickCount + 1,
          player: currentNumber,
        });
      }

      return t('teamForwardTurn', {
        number: pickCount + 1,
        player: currentNumber,
      });
    }

    if (isCurrentPlayer) {
      if (isBanning) {
        return t('yourBanTurn');
      }

      return t('yourPickTurn');
    }

    if (isBanning) {
      return t('opponentBanTurn', {
        player: getProfile(currentPlayerId ?? undefined).displayName,
      });
    }

    return t('opponentPickTurn', {
      player: getProfile(currentPlayerId ?? undefined).displayName,
    });
  }

  function getMobileTurnTitle(): string {
    if (isBanning) {
      return t('teamBanTurnMobile', {
        number: banCount + 1,
        player: currentNumber,
      });
    }

    if (isReverse) {
      return t('teamReverseTurnMobile', {
        number: pickCount + 1,
        player: currentNumber,
      });
    }

    return t('teamForwardTurnMobile', {
      number: pickCount + 1,
      player: currentNumber,
    });
  }

  function getEyebrow(): string {
    const mode = isElimination ? t('eliminationDraftMode') : t('draftMode');

    if (isTeam) {
      return t('teamEyebrow', { mode });
    }

    return t('duelEyebrow', { mode });
  }

  function getTeamTurnHint(): string {
    if (isBanning) {
      return t('teamBanHint');
    }

    if (isReverse) {
      return t('reverseHint');
    }

    if (pickCount >= 8) {
      return t('lastRoundHint');
    }

    return t('forwardHint');
  }

  function getNextTurnTitle(): string {
    if (isLastManualPick) {
      return t('lastPick', { number: nextNumber });
    }

    const options = {
      number: nextNumber,
      player: getProfile(nextPlayerId).displayName,
    };

    if (isBanning && banCount < selection.playerOrder.length - 1) {
      return t('nextBan', options);
    }

    return t('nextPick', options);
  }

  function getNextTurnHint(): string {
    if (isLastManualPick) {
      return t('automaticTransitionHint');
    }

    if (isBanning) {
      return t('afterBansHint');
    }

    if (isReverse) {
      return t('nextReverseHint');
    }

    if (pickCount >= 8) {
      return t('lastRoundHint');
    }

    return t('nextForwardHint');
  }

  function getDuelSequence(): string {
    if (isElimination) {
      return t('duelEliminationSequence');
    }

    return t('duelSequence');
  }

  function getActionHint(): string {
    if (candidateUnitId === null) {
      if (isCurrentPlayer) {
        return t('actionHint');
      }

      return t('waitHint');
    }

    const options = { unit: t(`units.${candidateUnitId}`) };

    if (!isBanning && nextPlayerId === userId) {
      return t('candidateRepeatHint', options);
    }

    return t('candidateHint', options);
  }
}

function requireCardSelection(selection: CardSelection | null): CardSelection {
  if (selection === null) {
    throw new Error('The card selection page requires card selection state.');
  }
  return selection;
}
