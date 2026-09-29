import {
  type CellId,
  type GameCoin,
  type UnitId,
  getTurnActionOptions,
} from '@war-chest/game-engine';
import clsx from 'clsx';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { GameActions, useTurnDraft } from '#/features/game-actions';
import { SurrenderGameButton } from '#/features/surrender-game';
import { useApiErrorMessage } from '#/shared/api';
import { appRoutes, getGamePageUrl } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import {
  type GameSynchronizationState,
  GameHeader,
  GameHeaderAction,
} from '#/widgets/game-navigation';
import { useGameRuntime } from '#/widgets/game-runtime';
import { type HandCoinClickInput, ActiveGameTable } from '#/widgets/game-table';
import { TurnQueue } from '#/widgets/turn-queue';
import { ActiveGameHeader } from './ActiveGameHeader';
import { ActiveGameSidebar } from './ActiveGameSidebar';
import { CardSelectionPage } from './CardSelectionPage';
import { getCoinWheelActions } from './getCoinWheelActions';
import classes from './ActiveGamePage.module.scss';

export function ActiveGamePage() {
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGamePage',
  });
  const { t: tUnit } = useTranslation('pages/active-game', {
    keyPrefix: 'CardSelectionPage',
  });

  const getApiErrorMessage = useApiErrorMessage();
  const navigate = useNavigate();
  const [selectedCoin, setSelectedCoin] = useState<SelectedCoin | null>(null);
  const [targetSelection, setTargetSelection] =
    useState<TargetSelection | null>(null);

  const {
    connectionError,
    gameId,
    gameError,
    hydrateGame,
    isGameError,
    isGamePending,
    liveState,
    playerProfiles,
    synchronizationStatus,
    userId,
  } = useGameRuntime();

  const {
    cancelDraft,
    confirmDraft,
    draft,
    error: draftError,
    isLoading: isDraftLoading,
    isPending: isDraftPending,
    saveDraft,
  } = useTurnDraft({
    gameId,
    onConfirmed: hydrateGame,
    userId,
    view: liveState,
  });

  if (gameId === '') {
    return <GameError message={t('notSelected')} onBack={openLobby} />;
  }

  if (liveState === null && isGamePending) {
    return (
      <>
        <GameHeader
          onBack={openLobby}
          stage=""
          synchronizationLabel={t('synchronization.pending')}
          synchronizationState="pending"
        />
        <main className={classes.page}>
          <section className={classes.state}>
            <LoadingIndicator label={t('connecting')} />
          </section>
        </main>
      </>
    );
  }

  if (liveState === null && isGameError) {
    return (
      <GameError
        message={gameError ?? t('gameUnavailable')}
        onBack={openLobby}
      />
    );
  }

  if (liveState === null) {
    return <GameError message={t('gameUnavailable')} onBack={openLobby} />;
  }

  if (liveState.status === 'waiting') {
    return <Navigate replace to={getGamePageUrl(gameId)} />;
  }

  const activeGameView = liveState;

  const currentPlayer = activeGameView.players.find(
    (player) => player.id === userId
  );
  const isParticipant = currentPlayer !== undefined;

  const liveEventSequence = liveState.lastEventSequence;
  const currentSelectedCoin =
    selectedCoin?.eventSequence === liveState.lastEventSequence
      ? selectedCoin
      : null;

  const activeDraft =
    draft?.baseVersion === liveState.lastEventSequence ? draft : null;

  const displayedView =
    activeDraft === null
      ? liveState
      : { ...liveState, battlefield: activeDraft.projectedBattlefield };

  const targetOptions =
    targetSelection === null
      ? null
      : getTurnActionOptions(liveState, userId, targetSelection.coinIndex);

  const headerContextAction = renderHeaderContextAction();
  const headerStage = getHeaderStage();

  return (
    <>
      <GameHeader
        contextAction={headerContextAction}
        onBack={openLobby}
        stage={headerStage}
        synchronizationLabel={getSynchronizationLabel()}
        synchronizationState={getSynchronizationState()}
      />

      <main
        className={clsx(classes.page, {
          [classes.selectionPage]: liveState.status === 'cardSelection',
        })}
      >
        {liveState.status === 'finished' ? (
          <>
            <ActiveGameHeader
              gameId={gameId}
              onBack={openLobby}
              playerProfiles={playerProfiles}
              userId={userId}
              view={liveState}
            />

            <div className={classes.finishedLayout}>
              <ActiveGameTable
                onHandCoinClick={handleHandCoinClick}
                playerProfiles={playerProfiles}
                selectedCoinIndex={null}
                userId={userId}
                view={liveState}
              />
              <ActiveGameSidebar
                gameId={gameId}
                onViewChanged={hydrateGame}
                userId={userId}
                view={liveState}
              />
            </div>
          </>
        ) : (
          <div className={classes.stageLayout}>
            <TurnQueue
              gameId={gameId}
              playerProfiles={playerProfiles}
              view={liveState}
            />
            {liveState.status === 'cardSelection' ? (
              <CardSelectionPage
                gameId={gameId}
                isConnectionReady={
                  synchronizationStatus === 'ready' && connectionError === null
                }
                onConfirmed={hydrateGame}
                playerProfiles={playerProfiles}
                userId={userId}
                view={liveState}
              />
            ) : (
              <div className={classes.layout}>
                <ActiveGameTable
                  deployCells={
                    targetSelection?.type === 'deploy'
                      ? targetOptions?.deployCells
                      : undefined
                  }
                  onCancelRecruitSelection={closeTargetSelection}
                  onDeployCellClick={handleDeployCellClick}
                  onHandCoinClick={handleHandCoinClick}
                  onRecruitUnitClick={handleRecruitUnitClick}
                  playerProfiles={playerProfiles}
                  recruitUnits={
                    targetSelection?.type === 'recruit'
                      ? targetOptions?.recruitUnits
                      : undefined
                  }
                  selectedCoinIndex={currentSelectedCoin?.index ?? null}
                  userId={userId}
                  view={displayedView}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {targetSelection?.type === 'deploy' && (
        <section aria-label={t('targetTitle')} className={classes.actionPanel}>
          <strong>{t('chooseDeployCell')}</strong>

          <Button onClick={closeTargetSelection} variant="secondary">
            {t('cancelSelection')}
          </Button>
        </section>
      )}

      {activeDraft !== null && (
        <section aria-label={t('draftTitle')} className={classes.actionPanel}>
          <strong>{t('draftTitle')}</strong>

          <span>
            {activeDraft.action.type === 'deploy'
              ? t('draftDeploy', { cellId: activeDraft.action.cellId })
              : t('draftRecruit', {
                  unit: tUnit(`units.${activeDraft.action.unitId}`),
                })}
          </span>

          <div className={classes.draftControls}>
            <Button
              disabled={isDraftPending}
              onClick={() => confirmDraft(activeDraft)}
            >
              {t('confirmTurn')}
            </Button>

            <Button
              disabled={isDraftPending}
              onClick={() => cancelDraft(activeDraft)}
              variant="secondary"
            >
              {t('cancelTurn')}
            </Button>
          </div>
        </section>
      )}

      {draftError !== null && (
        <p className={classes.draftError} role="alert">
          {getApiErrorMessage(draftError)}
        </p>
      )}

      {currentSelectedCoin === null ||
      activeDraft !== null ||
      targetSelection !== null ||
      isDraftLoading ? null : (
        <GameActions
          actions={getCoinWheelActions(
            currentSelectedCoin.coin,
            liveState.status === 'active' &&
              liveState.settings.format === 'duel' &&
              liveState.currentPlayerId === userId,
            getTurnActionOptions(liveState, userId, currentSelectedCoin.index)
          )}
          anchorElement={currentSelectedCoin.anchorElement}
          coin={currentSelectedCoin.coin}
          coinIndex={currentSelectedCoin.index}
          gameId={gameId}
          onClose={closeGameActions}
          onDeploy={() =>
            beginTargetSelection('deploy', currentSelectedCoin.index)
          }
          onPassed={hydrateGame}
          onRecruit={() =>
            beginTargetSelection('recruit', currentSelectedCoin.index)
          }
          view={liveState}
        />
      )}
    </>
  );

  function getSynchronizationLabel(): string {
    if (connectionError !== null) {
      return getApiErrorMessage(connectionError);
    }

    if (synchronizationStatus === 'ready') {
      return t('synchronization.ready');
    }

    return synchronizationStatus === 'desynchronized'
      ? t('synchronization.desynchronized')
      : t('synchronization.pending');
  }

  function getHeaderStage(): string {
    if (activeGameView.status === 'finished') {
      return '';
    }

    if (activeGameView.status === 'active') {
      return t('stage.active');
    }

    if (activeGameView.status === 'cardSelection') {
      return t('stage.cardSelection');
    }

    return '';
  }

  function renderHeaderContextAction() {
    if (!isParticipant || activeGameView.status === 'finished') {
      return undefined;
    }

    return (
      <SurrenderGameButton
        gameId={gameId}
        onSurrendered={hydrateGame}
        renderTrigger={(triggerProps) => (
          <GameHeaderAction
            disabled={triggerProps.disabled}
            kind="surrender"
            label={triggerProps.label}
            onClick={triggerProps.onClick}
          />
        )}
        view={activeGameView}
      />
    );
  }

  function getSynchronizationState(): GameSynchronizationState {
    if (connectionError !== null) {
      return 'error';
    }

    if (synchronizationStatus === 'ready') {
      return 'ready';
    }

    if (synchronizationStatus === 'desynchronized') {
      return 'resynchronizing';
    }

    return 'pending';
  }

  function openLobby(): void {
    void navigate(appRoutes.lobby.url());
  }

  function handleHandCoinClick(input: HandCoinClickInput): void {
    if (activeDraft !== null || isDraftPending || isDraftLoading) {
      return;
    }

    if (targetSelection !== null) {
      closeTargetSelection();
    }

    if (
      currentSelectedCoin?.index === input.index &&
      currentSelectedCoin.anchorElement === input.anchorElement
    ) {
      closeGameActions();
      return;
    }

    setSelectedCoin({
      ...input,
      eventSequence: liveEventSequence,
    });
  }

  function closeGameActions(): void {
    setSelectedCoin(null);
  }

  function beginTargetSelection(
    type: TargetSelection['type'],
    coinIndex: number
  ): void {
    setSelectedCoin(null);
    setTargetSelection({ coinIndex, type });
  }

  function closeTargetSelection(): void {
    setTargetSelection(null);
  }

  function handleDeployCellClick(cellId: CellId): void {
    if (targetSelection?.type !== 'deploy') {
      return;
    }

    saveDraft({
      action: { cellId, type: 'deploy' },
      coinIndex: targetSelection.coinIndex,
    });
    closeTargetSelection();
  }

  function handleRecruitUnitClick(unitId: UnitId): void {
    if (targetSelection?.type !== 'recruit') {
      return;
    }

    saveDraft({
      action: { type: 'recruit', unitId },
      coinIndex: targetSelection.coinIndex,
    });
    closeTargetSelection();
  }
}

interface TargetSelection {
  coinIndex: number;
  type: 'deploy' | 'recruit';
}

interface SelectedCoin {
  anchorElement: HTMLButtonElement;
  coin: GameCoin;
  eventSequence: number;
  index: number;
}

interface GameErrorProps {
  message: string;
  onBack(this: void): void;
}

function GameError(props: GameErrorProps) {
  const { message, onBack } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'GameError',
  });

  return (
    <>
      <GameHeader
        onBack={onBack}
        stage=""
        synchronizationLabel={message}
        synchronizationState="error"
      />
      <main className={classes.page}>
        <section className={classes.state}>
          <h1>{t('title')}</h1>
          <p role="alert">{message}</p>
          <Button onClick={onBack}>{t('backToLobby')}</Button>
        </section>
      </main>
    </>
  );
}
