import type { GameCoin } from '@war-chest/game-engine';
import clsx from 'clsx';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { GameActions } from '#/features/game-actions';
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
import { ActiveGameHeader } from './ActiveGameHeader';
import { ActiveGameSidebar } from './ActiveGameSidebar';
import { ActiveGameTable } from './ActiveGameTable';
import { CardSelectionPage } from './CardSelectionPage';
import { getCoinWheelActions } from './getCoinWheelActions';
import type { HandCoinClickInput } from './PlayerPanel';
import { TurnQueue } from './TurnQueue';
import classes from './ActiveGamePage.module.scss';

export function ActiveGamePage() {
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGamePage',
  });

  const getApiErrorMessage = useApiErrorMessage();
  const navigate = useNavigate();
  const [selectedCoin, setSelectedCoin] = useState<SelectedCoin | null>(null);

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
                  onHandCoinClick={handleHandCoinClick}
                  playerProfiles={playerProfiles}
                  selectedCoinIndex={currentSelectedCoin?.index ?? null}
                  userId={userId}
                  view={liveState}
                />
              </div>
            )}
          </div>
        )}
      </main>
      {currentSelectedCoin === null ? null : (
        <GameActions
          actions={getCoinWheelActions(
            currentSelectedCoin.coin,
            liveState.status === 'active' &&
              liveState.settings.format === 'duel' &&
              liveState.currentPlayerId === userId
          )}
          anchorElement={currentSelectedCoin.anchorElement}
          coin={currentSelectedCoin.coin}
          coinIndex={currentSelectedCoin.index}
          gameId={gameId}
          onClose={closeGameActions}
          onPassed={hydrateGame}
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
