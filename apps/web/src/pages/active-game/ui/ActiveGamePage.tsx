import { Navigate, useNavigate } from 'react-router';
import { useApiErrorMessage } from '#/shared/api';
import { appRoutes, getGamePageUrl } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import { useGameRuntime } from '#/widgets/game-runtime';
import { ActiveGameHeader } from './ActiveGameHeader';
import { ActiveGameSidebar } from './ActiveGameSidebar';
import { ActiveGameTable } from './ActiveGameTable';
import classes from './ActiveGamePage.module.scss';

export function ActiveGamePage() {
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGamePage',
  });

  const getApiErrorMessage = useApiErrorMessage();
  const navigate = useNavigate();

  const {
    connectionError,
    gameId,
    gameQuery,
    hydrateGame,
    liveState,
    playerProfiles,
    synchronizationStatus,
    userId,
  } = useGameRuntime();

  if (gameId === '') {
    return <GameError message={t('notSelected')} onBack={openLobby} />;
  }

  if (liveState === null && gameQuery.isPending) {
    return (
      <main className={classes.page}>
        <section className={classes.state}>
          <LoadingIndicator label={t('connecting')} />
        </section>
      </main>
    );
  }

  if (liveState === null && gameQuery.isError) {
    return (
      <GameError
        message={getApiErrorMessage(gameQuery.error)}
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

  return (
    <main className={classes.page}>
      <ActiveGameHeader
        gameId={gameId}
        onBack={openLobby}
        playerProfiles={playerProfiles}
        userId={userId}
        view={liveState}
      />

      <div className={classes.runtimeStatus}>
        <span data-ready={synchronizationStatus === 'ready'}>
          {getSynchronizationLabel()}
        </span>
        {connectionError === null ? null : (
          <p role="alert">{getApiErrorMessage(connectionError)}</p>
        )}
      </div>

      <div className={classes.layout}>
        <ActiveGameTable
          playerProfiles={playerProfiles}
          players={liveState.players}
          userId={userId}
        />
        <ActiveGameSidebar
          gameId={gameId}
          onSurrendered={hydrateGame}
          userId={userId}
          view={liveState}
        />
      </div>
    </main>
  );

  function getSynchronizationLabel(): string {
    if (synchronizationStatus === 'ready') {
      return t('synchronization.ready');
    }

    return synchronizationStatus === 'desynchronized'
      ? t('synchronization.desynchronized')
      : t('synchronization.pending');
  }

  function openLobby(): void {
    void navigate(appRoutes.lobby.url());
  }
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
    <main className={classes.page}>
      <section className={classes.state}>
        <h1>{t('title')}</h1>
        <p role="alert">{message}</p>
        <Button onClick={onBack}>{t('backToLobby')}</Button>
      </section>
    </main>
  );
}
