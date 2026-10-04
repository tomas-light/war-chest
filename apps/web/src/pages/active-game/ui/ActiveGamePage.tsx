import {
  type CellId,
  type GameCoin,
  type TurnAction,
  type UnitId,
  getTurnActionOptions,
  getUnitTacticOptions,
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
  const [selectedManeuverUnit, setSelectedManeuverUnit] =
    useState<SelectedManeuverUnit | null>(null);

  const {
    connectionError,
    gameId,
    gameError,
    hydrateGame,
    isGameError,
    isGamePending,
    liveState,
    playerProfiles,
    replay,
    synchronizationStatus,
    userId,
    viewedState,
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

  const activeGameView = viewedState ?? liveState;
  const isViewingHistory =
    activeGameView.lastEventSequence !== liveState.lastEventSequence;
  const isReadOnly =
    isViewingHistory ||
    replay.status === 'loading' ||
    replay.status === 'error';
  const historyControls = {
    error: replay.error === null ? null : getApiErrorMessage(replay.error),
    moveNumber: activeGameView.moveCount,
    sequence: activeGameView.lastEventSequence,
    status: replay.status,
    onPause: replay.pauseReplay,
    onPlay: replay.playReplay,
    onReturnToLive: returnToLive,
    onRetry: replay.retryReplay,
    onSelect: selectHistory,
  };

  const activeDraft =
    !isReadOnly && draft?.baseVersion === liveState.lastEventSequence
      ? draft
      : null;

  const tacticManeuvers =
    activeDraft?.action.type === 'tactic' ? activeDraft.action.maneuvers : [];
  const tacticOptions = getUnitTacticOptions({
    coinIndex: selectedTarget?.coinIndex ?? activeDraft?.coinIndex ?? -1,
    game: liveState,
    maneuvers: tacticManeuvers,
    playerId: userId,
  });

  const targetSelection: TargetSelection | null =
    !isReadOnly && selectedTarget?.eventSequence === liveState.lastEventSequence
      ? selectedTarget
      : activeDraft?.action.type === 'tactic' &&
          tacticOptions !== null &&
          !tacticOptions.isComplete
        ? {
            battlefieldUnitId: null,
            coinIndex: activeDraft.coinIndex,
            eventSequence: liveState.lastEventSequence,
            type: 'tactic',
          }
        : null;
  const currentManeuverUnit =
    !isReadOnly &&
    targetSelection?.type === 'tactic' &&
    selectedManeuverUnit?.eventSequence === liveState.lastEventSequence
      ? selectedManeuverUnit
      : null;

  const currentPlayer = activeGameView.players.find(
    (player) => player.id === userId
  );
  const isParticipant = currentPlayer !== undefined;

  const liveEventSequence = liveState.lastEventSequence;
  const currentSelectedCoin =
    !isReadOnly && selectedCoin?.eventSequence === liveState.lastEventSequence
      ? selectedCoin
      : null;

  const displayedView =
    activeDraft === null
      ? activeGameView
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
        {liveState.status === 'finished' && !isReadOnly ? (
          <>
            <ActiveGameHeader
              gameId={gameId}
              onBack={openLobby}
              playerProfiles={playerProfiles}
              userId={userId}
              view={liveState}
            />

            <div className={classes.stageLayout}>
              <TurnQueue
                gameId={gameId}
                history={historyControls}
                playerProfiles={playerProfiles}
                userId={userId}
                view={liveState}
              />
              <div className={classes.layout}>
                <ActiveGameTable
                  onHandCoinClick={handleHandCoinClick}
                  playerProfiles={playerProfiles}
                  selectedCoinIndex={null}
                  userId={userId}
                  view={liveState}
                />
              </div>
            </div>
          </>
        ) : (
          <div className={classes.stageLayout}>
            <TurnQueue
              gameId={gameId}
              history={historyControls}
              playerProfiles={playerProfiles}
              userId={userId}
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
                  readOnly={isReadOnly}
                  selectedCoinIndex={currentSelectedCoin?.index ?? null}
                  selectedUnitId={
                    currentManeuverUnit?.battlefieldUnitId ??
                    targetSelection?.battlefieldUnitId
                  }
                  userId={userId}
                  view={displayedView}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {activeDraft === null &&
        currentManeuverUnit === null &&
        (targetSelection?.type === 'deploy' ||
          targetSelection?.type === 'move' ||
          targetSelection?.type === 'tactic') && (
          <section
            aria-label={t('targetTitle')}
            className={classes.actionPanel}
          >
            <strong>{getTargetPrompt()}</strong>

            <Button onClick={closeTargetSelection} variant="secondary">
              {t('cancelSelection')}
            </Button>
          </section>
        )}

      {activeDraft !== null && currentManeuverUnit === null && (
        <section aria-label={t('draftTitle')} className={classes.actionPanel}>
          <strong>{t('draftTitle')}</strong>

          <span>{getDraftDescription(activeDraft.action)}</span>
          {targetSelection === null ? null : (
            <strong>{getTargetPrompt()}</strong>
          )}

          <div className={classes.draftControls}>
            <Button
              disabled={
                isDraftPending ||
                (activeDraft.action.type === 'tactic' &&
                  tacticOptions?.isComplete !== true)
              }
              onClick={handleConfirmDraft}
            >
              {t('confirmTurn')}
            </Button>

            <Button
              disabled={isDraftPending}
              onClick={handleCancelDraft}
              variant="secondary"
            >
              {t('cancelTurn')}
            </Button>
          </div>
        </section>
      )}

      {currentManeuverUnit !== null && tacticOptions !== null && (
        <GameActions
          actions={[]}
          anchorElement={currentManeuverUnit.anchorElement}
          canMove={tacticOptions.moves.some(
            (move) =>
              move.battlefieldUnitId === currentManeuverUnit.battlefieldUnitId
          )}
          coin={{ kind: 'unit', unitId: tacticOptions.unitId }}
          coinIndex={currentManeuverUnit.coinIndex}
          gameId={gameId}
          initialWheel="maneuver"
          key={`${currentManeuverUnit.battlefieldUnitId}-${tacticManeuvers.length}`}
          onClose={closeManeuverWheel}
          onDeploy={closeManeuverWheel}
          onMove={selectTacticMovement}
          onPassed={hydrateGame}
          onRecruit={closeManeuverWheel}
          view={liveState}
        />
      )}

      {!isReadOnly && draftError !== null && (
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
          onTactic={() =>
            beginTargetSelection('tactic', currentSelectedCoin.index)
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
    if (targetSelection?.type === 'tactic') {
      return tacticOptions?.moves.map((move) => move.battlefieldUnitId);
    }

    if (targetSelection?.type === 'move') {
      return targetOptions?.moves.map((move) => move.battlefieldUnitId);
    }

    return undefined;
  }

  function getMoveCells() {
    if (targetSelection?.type === 'tactic') {
      if (currentManeuverUnit !== null) {
        return undefined;
      }

      return tacticOptions?.moves.find(
        (move) => move.battlefieldUnitId === targetSelection.battlefieldUnitId
      )?.cellIds;
    }

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
      if (targetSelection.type === 'tactic' && tacticOptions !== null) {
        return t('chooseTacticUnit', {
          number: tacticManeuvers.length + 1,
          total: tacticOptions.maneuverLimit,
          unit: tUnit(`units.${tacticOptions.unitId}`),
        });
      }

      return t('chooseMoveUnit');
    }

    return t('chooseMoveCell');
  }

  function getDraftDescription(action: TurnAction): string {
    if (action.type === 'tactic') {
      return action.maneuvers
        .map((maneuver) => getDraftDescription(maneuver))
        .join('; ');
    }

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
    if (isReadOnly || !isParticipant || activeGameView.status === 'finished') {
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
    if (
      isReadOnly ||
      activeDraft !== null ||
      isDraftPending ||
      isDraftLoading
    ) {
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

  function selectHistory(sequence: number): void {
    setSelectedCoin(null);
    setTargetSelection(null);
    setSelectedManeuverUnit(null);
    void replay.viewHistory(sequence);
  }

  function returnToLive(): void {
    setSelectedCoin(null);
    setTargetSelection(null);
    setSelectedManeuverUnit(null);
    replay.returnToLive();
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
    setSelectedManeuverUnit(null);
  }

  function closeManeuverWheel(): void {
    setSelectedManeuverUnit(null);
  }

  function handleCancelDraft(): void {
    if (activeDraft === null) {
      return;
    }

    closeTargetSelection();
    cancelDraft(activeDraft);
  }

  function handleConfirmDraft(): void {
    if (activeDraft === null) {
      return;
    }

    closeTargetSelection();
    confirmDraft(activeDraft);
  }

  function selectTacticMovement(): void {
    if (currentManeuverUnit === null) {
      return;
    }

    setTargetSelection({
      battlefieldUnitId: currentManeuverUnit.battlefieldUnitId,
      coinIndex: currentManeuverUnit.coinIndex,
      eventSequence: liveEventSequence,
      type: 'tactic',
    });
    closeManeuverWheel();
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

  function handleMoveUnitClick(
    battlefieldUnitId: string,
    anchorElement: HTMLButtonElement
  ): void {
    if (
      (targetSelection?.type !== 'move' &&
        targetSelection?.type !== 'tactic') ||
      isDraftPending
    ) {
      return;
    }

    if (targetSelection.type === 'tactic') {
      setSelectedManeuverUnit({
        anchorElement,
        battlefieldUnitId,
        coinIndex: targetSelection.coinIndex,
        eventSequence: liveEventSequence,
      });
      return;
    }

    setTargetSelection({ ...targetSelection, battlefieldUnitId });
  }

  function handleMoveCellClick(cellId: CellId): void {
    if (
      (targetSelection?.type !== 'move' &&
        targetSelection?.type !== 'tactic') ||
      targetSelection.battlefieldUnitId === null ||
      isDraftPending
    ) {
      return;
    }

    if (targetSelection.type === 'tactic') {
      if (tacticOptions === null) {
        return;
      }

      saveDraft({
        action: {
          maneuvers: [
            ...tacticManeuvers,
            {
              battlefieldUnitId: targetSelection.battlefieldUnitId,
              cellId,
              type: 'move',
            },
          ],
          type: 'tactic',
          unitId: tacticOptions.unitId,
        },
        coinIndex: targetSelection.coinIndex,
      });
      closeTargetSelection();
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
  type: 'deploy' | 'move' | 'recruit' | 'tactic';
}

interface SelectedCoin {
  anchorElement: HTMLButtonElement;
  coin: GameCoin;
  eventSequence: number;
  index: number;
}

interface SelectedManeuverUnit {
  anchorElement: HTMLButtonElement;
  battlefieldUnitId: string;
  coinIndex: number;
  eventSequence: number;
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
