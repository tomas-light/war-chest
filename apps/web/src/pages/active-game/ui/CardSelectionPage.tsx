import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import {
  type CardSelection,
  type GameView,
  type UnitId,
  getCurrentCardSelectionPlayer,
} from '@war-chest/game-engine';
import { useEffect, useState } from 'react';
import { AutoCompleteCardSelection } from '#/features/complete-card-selection';
import { ConfirmCardChoiceButton } from '#/features/confirm-card-choice';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { CardSelectionCard } from './CardSelectionCard';
import classes from './CardSelectionPage.module.scss';

interface Props {
  gameId: string;
  isConnectionReady: boolean;
  onConfirmed(this: void, view: GameView): void;
  playerProfiles: readonly LobbyGamePlayer[];
  userId: string;
  view: GameView;
}

interface Candidate {
  unitId: UnitId;
  version: number;
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

  const [candidate, setCandidate] = useState<Candidate | null>(null);

  const selection = requireCardSelection(view.cardSelection);
  const currentPlayerId = getCurrentCardSelectionPlayer(selection);
  const isCurrentPlayer = currentPlayerId === userId;
  const isBanning = selection.phase === 'banning';
  const isComplete = selection.phase === 'complete';
  const cardsPerPlayer = view.settings.format === 'team' ? 3 : 4;
  const totalPicks = cardsPerPlayer * selection.playerOrder.length;
  const pickCount = selection.choices.filter(
    (choice) => choice.action === 'pick'
  ).length;
  const candidateUnitId =
    candidate?.version === view.lastEventSequence && isCurrentPlayer
      ? candidate.unitId
      : null;
  const canChoose = !isComplete && isCurrentPlayer && isConnectionReady;
  const isParticipant = view.players.some(
    (player) => player.id === userId && player.presence === 'connected'
  );
  const currentUser = view.players.find((player) => player.id === userId);

  useEffect(() => {
    if (candidateUnitId === null) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest('[data-card-selection-option]') !== null
      ) {
        return;
      }

      setCandidate(null);
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [candidateUnitId]);

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
    <section className={classes.selection}>
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
              confirmationControl={
                candidateUnitId === unitId ? (
                  <ConfirmCardChoiceButton
                    disabled={!canChoose}
                    gameId={gameId}
                    onConfirmed={handleConfirmed}
                    unitId={unitId}
                    view={view}
                  />
                ) : undefined
              }
              disabled={!canChoose || choice !== undefined}
              isAlly={
                currentUser !== undefined && owner?.team === currentUser.team
              }
              isCandidate={candidateUnitId === unitId}
              isOwn={choice?.playerId === userId}
              key={unitId}
              onSelect={() => handleCardSelect(unitId)}
              owner={ownerProfile}
              unitId={unitId}
            />
          );
        })}
      </div>
    </section>
  );

  function handleConfirmed(nextView: GameView): void {
    setCandidate(null);
    onConfirmed(nextView);
  }

  function handleCardSelect(unitId: UnitId): void {
    if (candidateUnitId === unitId) {
      setCandidate(null);
      return;
    }

    setCandidate({ unitId, version: view.lastEventSequence });
  }

  function getProfile(playerId: string): LobbyGamePlayer {
    const profile = playerProfiles.find((player) => player.id === playerId);
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
}

function requireCardSelection(selection: CardSelection | null): CardSelection {
  if (selection === null) {
    throw new Error('The card selection page requires card selection state.');
  }

  return selection;
}
