import { type ReactNode, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { LeaveGameButton } from '#/features/leave-game';
import { StartGameButton } from '#/features/start-game';
import { SwapPlayerPositionsButton } from '#/features/swap-player-positions';
import { UpdateGameSettingsForm } from '#/features/update-game-settings';
import { useApiErrorMessage } from '#/shared/api';
import {
  appRoutes,
  getActiveGamePageUrl,
  getGamePageUrl,
} from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import {
  type GameSynchronizationState,
  GameHeader,
  GameHeaderAction,
} from '#/widgets/game-navigation';
import { TeamPositions } from '#/widgets/game-positions';
import { useGameRuntime } from '#/widgets/game-runtime';
import classes from './GamePage.module.scss';

export function GamePage() {
  const { t } = useTranslation('pages/game', {
    keyPrefix: 'GamePage',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLeavingGame, setIsLeavingGame] = useState(false);
  const {
    connectionError,
    currentPlayerGameId,
    gameId,
    gameError,
    hydrateGame,
    isGameError,
    isGamePending,
    isLobbyPending,
    liveState,
    playerProfiles,
    synchronizationStatus,
    userId,
  } = useGameRuntime();

  if (gameId === '') {
    return <GameError message={t('notSelected')} onBack={openLobby} />;
  }

  if (liveState === null && isGamePending) {
    return (
      <>
        <GameHeader
          onBack={openLobby}
          stage={t('stage')}
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

  if (!isLeavingGame && connectionError?.code === 'game_not_found') {
    return (
      <GameError
        message={getApiErrorMessage(connectionError)}
        onBack={openLobby}
      />
    );
  }

  if (liveState.status !== 'waiting') {
    return <Navigate replace to={getActiveGamePageUrl(gameId)} />;
  }

  const currentPlayer = liveState.players.find(
    (player) => player.id === userId
  );
  const isPlayer = currentPlayer !== undefined;
  const isCreator = liveState.creatorId === userId;
  const requiredPlayerCount = liveState.settings.format === 'duel' ? 2 : 4;
  const isReadyToStart = liveState.players.length === requiredPlayerCount;
  const hasAnotherPlayerGame =
    currentPlayerGameId !== null && currentPlayerGameId !== gameId;
  const isSpectatorMode = searchParams.get('mode') === 'watch';
  const canChoosePosition =
    !isLobbyPending && !hasAnotherPlayerGame && !isReadyToStart;
  const isRoleSelectionOpen =
    !isPlayer &&
    !(isCreator && isReadyToStart) &&
    !hasAnotherPlayerGame &&
    !isLobbyPending &&
    !isSpectatorMode;
  const preparationView = liveState;

  return (
    <>
      <GameHeader
        contextAction={
          isCreator || isPlayer ? (
            <LeaveGameButton
              gameId={gameId}
              isCreator={isCreator}
              onLeaveFailed={stopLeavingGame}
              onLeaving={startLeavingGame}
              onLeft={openLobby}
              renderTrigger={(triggerProps) => (
                <GameHeaderAction
                  disabled={triggerProps.disabled}
                  kind="close"
                  label={triggerProps.label}
                  onClick={triggerProps.onClick}
                />
              )}
              view={liveState}
            />
          ) : undefined
        }
        onBack={openLobby}
        stage={t('stage')}
        synchronizationLabel={getHeaderSynchronizationLabel()}
        synchronizationState={getHeaderSynchronizationState()}
      />
      <main className={classes.page}>
        <section className={classes.gameShell}>
          <div
            className={classes.positions}
            data-format={liveState.settings.format}
          >
            <TeamPositions
              canJoin={canChoosePosition}
              gameId={gameId}
              onJoined={hydrateGame}
              profiles={playerProfiles}
              team="white"
              userId={userId}
              view={liveState}
            />
            {liveState.settings.format === 'duel' ? (
              <div className={classes.versusActions}>
                <span aria-hidden="true" className={classes.versus}>
                  VS
                </span>
                {isCreator && isReadyToStart ? (
                  <SwapPlayerPositionsButton
                    gameId={gameId}
                    onSwapped={hydrateGame}
                    view={liveState}
                  />
                ) : null}
              </div>
            ) : null}
            <TeamPositions
              canJoin={canChoosePosition}
              gameId={gameId}
              onJoined={hydrateGame}
              profiles={playerProfiles}
              team="black"
              userId={userId}
              view={liveState}
            />
          </div>

          <UpdateGameSettingsForm
            gameId={gameId}
            isEditable={isCreator}
            onUpdated={hydrateGame}
            view={liveState}
          />

          <div className={classes.primaryActions}>{renderPrimaryActions()}</div>
        </section>
      </main>
    </>
  );

  function openLobby(): void {
    void navigate(appRoutes.lobby.url());
  }

  function startLeavingGame(): void {
    setIsLeavingGame(true);
  }

  function stopLeavingGame(): void {
    setIsLeavingGame(false);
  }

  function openSpectatorMode(): void {
    setSearchParams({ mode: 'watch' });
  }

  function renderPrimaryActions(): ReactNode {
    if (isCreator && isReadyToStart) {
      return (
        <StartGameButton
          gameId={gameId}
          onStarted={hydrateGame}
          view={preparationView}
        />
      );
    }

    if (isRoleSelectionOpen) {
      return (
        <>
          <Button disabled>{t('selectFreeSeat')}</Button>
          <Button onClick={openSpectatorMode} variant="secondary">
            {t('watch')}
          </Button>
        </>
      );
    }

    if (isCreator || isPlayer) {
      const label = isReadyToStart
        ? t('waitingForStart')
        : t('waitingPlayers', {
            count: preparationView.players.length,
            total: requiredPlayerCount,
          });

      return <Button disabled>{label}</Button>;
    }

    if (hasAnotherPlayerGame) {
      return (
        <Button
          onClick={() => void navigate(getGamePageUrl(currentPlayerGameId))}
          variant="secondary"
        >
          {t('returnToOwnGame')}
        </Button>
      );
    }

    return null;
  }

  function getHeaderSynchronizationLabel(): string {
    if (connectionError !== null && !isLeavingGame) {
      return getApiErrorMessage(connectionError);
    }

    return t(getSynchronizationLabelKey(synchronizationStatus));
  }

  function getHeaderSynchronizationState(): GameSynchronizationState {
    if (connectionError !== null && !isLeavingGame) {
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
}

interface GameErrorProps {
  message: string;
  onBack(this: void): void;
}

function GameError(props: GameErrorProps) {
  const { message, onBack } = props;
  const { t } = useTranslation('pages/game', {
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

function getSynchronizationLabelKey(status: string) {
  if (status === 'ready') {
    return 'synchronization.ready' as const;
  }

  return status === 'desynchronized'
    ? ('synchronization.desynchronized' as const)
    : ('synchronization.pending' as const);
}
