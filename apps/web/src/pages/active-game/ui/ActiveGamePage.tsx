import {
  type CellId,
  type GameCoin,
  type TurnAction,
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
  const [selectedTarget, setTargetSelection] = useState<TargetSelection | null>(
    null
  );

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

  const targetSelection =
    selectedTarget?.eventSequence === liveState.lastEventSequence
      ? selectedTarget
      : null;

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

  const deployCells = getDeployCells();
  const recruitUnits = getRecruitUnits();
  const movableUnitIds = getMovableUnitIds();
  const moveCells = getMoveCells();

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
                  deployCells={deployCells}
                  moveCells={moveCells}
                  movableUnitIds={movableUnitIds}
                  onCancelRecruitSelection={closeTargetSelection}
                  onDeployCellClick={handleDeployCellClick}
                  onHandCoinClick={handleHandCoinClick}
                  onMoveCellClick={handleMoveCellClick}
                  onMoveUnitClick={handleMoveUnitClick}
                  onRecruitUnitClick={handleRecruitUnitClick}
                  playerProfiles={playerProfiles}
                  recruitUnits={recruitUnits}
                  selectedCoinIndex={currentSelectedCoin?.index ?? null}
                  selectedUnitId={targetSelection?.battlefieldUnitId}
                  userId={userId}
                  view={displayedView}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {(targetSelection?.type === 'deploy' ||
        targetSelection?.type === 'move') && (
        <section aria-label={t('targetTitle')} className={classes.actionPanel}>
          <strong>{getTargetPrompt()}</strong>

          <Button onClick={closeTargetSelection} variant="secondary">
            {t('cancelSelection')}
          </Button>
        </section>
      )}

      {activeDraft !== null && (
        <section aria-label={t('draftTitle')} className={classes.actionPanel}>
          <strong>{t('draftTitle')}</strong>

          <span>{getDraftDescription(activeDraft.action)}</span>

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
          canMove={
            getTurnActionOptions(liveState, userId, currentSelectedCoin.index)
              .moves.length > 0
          }
          gameId={gameId}
          onClose={closeGameActions}
          onDeploy={() =>
            beginTargetSelection('deploy', currentSelectedCoin.index)
          }
          onMove={() => beginTargetSelection('move', currentSelectedCoin.index)}
          onPassed={hydrateGame}
          onRecruit={() =>
            beginTargetSelection('recruit', currentSelectedCoin.index)
          }
          view={liveState}
        />
      )}
    </>
  );

  function getDeployCells() {
    if (targetSelection?.type === 'deploy') {
      return targetOptions?.deployCells;
    }

    return undefined;
  }

  function getRecruitUnits() {
    if (targetSelection?.type === 'recruit') {
      return targetOptions?.recruitUnits;
    }

    return undefined;
  }

  function getMovableUnitIds() {
    if (targetSelection?.type === 'move') {
      return targetOptions?.moves.map((move) => move.battlefieldUnitId);
    }

    return undefined;
  }

  function getMoveCells() {
    if (targetSelection?.type === 'move') {
      return targetOptions?.moves.find(
        (move) => move.battlefieldUnitId === targetSelection.battlefieldUnitId
      )?.cellIds;
    }

    return undefined;
  }

  function getTargetPrompt(): string {
    if (targetSelection?.type === 'deploy') {
      return t('chooseDeployCell');
    }

    if (targetSelection?.battlefieldUnitId === null) {
      return t('chooseMoveUnit');
    }

    return t('chooseMoveCell');
  }

  function getDraftDescription(action: TurnAction): string {
    if (action.type === 'deploy') {
      return t('draftDeploy', { cellId: action.cellId });
    }

    if (action.type === 'move') {
      const unit = liveState?.battlefield?.units.find(
        (item) => item.id === action.battlefieldUnitId
      );

      return t('draftMove', { from: unit?.cellId, to: action.cellId });
    }

    return t('draftRecruit', { unit: tUnit(`units.${action.unitId}`) });
  }

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
    let battlefieldUnitId: string | null = null;

    if (type === 'move') {
      const options = getTurnActionOptions(activeGameView, userId, coinIndex);
      const [onlyMove] = options.moves;

      if (options.moves.length === 1 && onlyMove !== undefined) {
        battlefieldUnitId = onlyMove.battlefieldUnitId;
      }
    }

    setSelectedCoin(null);
    setTargetSelection({
      battlefieldUnitId,
      coinIndex,
      eventSequence: liveEventSequence,
      type,
    });
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

  function handleMoveUnitClick(battlefieldUnitId: string): void {
    if (targetSelection?.type !== 'move' || isDraftPending) {
      return;
    }

    setTargetSelection({ ...targetSelection, battlefieldUnitId });
  }

  function handleMoveCellClick(cellId: CellId): void {
    if (
      targetSelection?.type !== 'move' ||
      targetSelection.battlefieldUnitId === null ||
      isDraftPending
    ) {
      return;
    }

    saveDraft({
      action: {
        battlefieldUnitId: targetSelection.battlefieldUnitId,
        cellId,
        type: 'move',
      },
      coinIndex: targetSelection.coinIndex,
    });
    closeTargetSelection();
  }
}

interface TargetSelection {
  battlefieldUnitId: string | null;
  coinIndex: number;
  eventSequence: number;
  type: 'deploy' | 'move' | 'recruit';
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
