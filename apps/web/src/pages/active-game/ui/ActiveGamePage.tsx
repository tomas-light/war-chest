import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameStatus, GameViewPlayer } from '@war-chest/game-engine';
import { Navigate, useNavigate } from 'react-router';
import { UserAvatar } from '#/entities/user';
import { SurrenderGameButton } from '#/features/surrender-game';
import { useApiErrorMessage } from '#/shared/api';
import { appRoutes, getGamePageUrl } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import { useGameRuntime } from '#/widgets/game-runtime';
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

  const currentPlayer = liveState.players.find(
    (player) => player.id === userId
  );
  const opponent = liveState.players.find((player) => player.id !== userId);
  const whitePlayer = liveState.players.find(
    (player) => player.team === 'white'
  );
  const blackPlayer = liveState.players.find(
    (player) => player.team === 'black'
  );
  const topPlayer = currentPlayer === undefined ? whitePlayer : opponent;
  const bottomPlayer = currentPlayer ?? blackPlayer;
  const isSpectator = currentPlayer === undefined;
  const winnerPlayer = liveState.players.find(
    (player) => player.team === liveState.winnerTeam
  );
  const winnerProfile = findProfile(winnerPlayer);
  const gameTitleKey = getGameTitleKey({
    currentPlayer,
    hasWinner: winnerPlayer !== undefined,
    isSpectator,
    opponent,
    status: liveState.status,
  });
  const gameTitle =
    gameTitleKey === 'spectatorWinnerTitle' && winnerPlayer !== undefined
      ? t(gameTitleKey, {
          winner:
            winnerProfile?.displayName ??
            t('winnerFallback', { playerId: winnerPlayer.id.slice(0, 8) }),
        })
      : t(gameTitleKey);

  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <div>
          <p className={classes.eyebrow}>
            {isSpectator ? t('spectator') : t('table')}
          </p>
          <h1>{gameTitle}</h1>
          <p className={classes.gameId}>{t('gameLabel', { gameId })}</p>
        </div>
        <Button onClick={openLobby}>{t('backToLobby')}</Button>
      </header>

      <div className={classes.runtimeStatus}>
        <span data-ready={synchronizationStatus === 'ready'}>
          {t(getSynchronizationLabelKey(synchronizationStatus))}
        </span>
        {connectionError === null ? null : (
          <p role="alert">{getApiErrorMessage(connectionError)}</p>
        )}
      </div>

      <div className={classes.layout}>
        <section aria-label={t('tableArea')} className={classes.tableArea}>
          <PlayerPanel
            label={isSpectator ? t('playerTop') : t('opponent')}
            player={topPlayer}
            profile={findProfile(topPlayer)}
          />

          <div className={classes.boardPlaceholder}>
            <span>{t('boardLabel')}</span>
            <p>{t('boardDescription')}</p>
          </div>

          <PlayerPanel
            isCurrent={!isSpectator}
            label={isSpectator ? t('playerBottom') : t('you')}
            player={bottomPlayer}
            profile={findProfile(bottomPlayer)}
          />
        </section>

        <aside className={classes.sidebar}>
          {liveState.status === 'active' ? (
            <section className={classes.sidebarSection}>
              <p className={classes.sidebarEyebrow}>{t('turnEyebrow')}</p>
              <h2>{t('actionsTitle')}</h2>
              <p>
                {t(
                  getTurnDescriptionKey({
                    currentPlayerId: liveState.currentPlayerId,
                    isSpectator,
                    userId,
                  })
                )}
              </p>
              <div className={classes.placeholderActions}>
                <Button disabled>{t('chooseSquad')}</Button>
                <Button disabled variant="secondary">
                  {t('finishAction')}
                </Button>
                {currentPlayer === undefined ? null : (
                  <SurrenderGameButton
                    gameId={gameId}
                    onSurrendered={hydrateGame}
                    view={liveState}
                  />
                )}
              </div>
            </section>
          ) : null}

          <section className={classes.sidebarSection}>
            <p className={classes.sidebarEyebrow}>{t('historyEyebrow')}</p>
            <h2>{t('historyTitle')}</h2>
            <p>{t('historyDescription')}</p>
            <Button disabled variant="secondary">
              {t('openHistory')}
            </Button>
          </section>
        </aside>
      </div>
    </main>
  );

  function findProfile(
    player: GameViewPlayer | undefined
  ): LobbyGamePlayer | undefined {
    return playerProfiles.find((profile) => profile.id === player?.id);
  }

  function openLobby(): void {
    void navigate(appRoutes.lobby.url());
  }
}

interface GameTitleInput {
  currentPlayer: GameViewPlayer | undefined;
  hasWinner: boolean;
  isSpectator: boolean;
  opponent: GameViewPlayer | undefined;
  status: GameStatus;
}

function getGameTitleKey(input: GameTitleInput) {
  if (input.status !== 'finished') {
    return 'gameTitle' as const;
  }

  if (input.isSpectator && input.hasWinner) {
    return 'spectatorWinnerTitle' as const;
  }

  if (input.currentPlayer?.defeatReason === 'surrender') {
    return 'surrenderedTitle' as const;
  }

  if (!input.isSpectator && input.opponent?.defeatReason === 'surrender') {
    return 'opponentSurrenderedTitle' as const;
  }

  return 'finishedTitle' as const;
}

interface PlayerPanelProps {
  isCurrent?: boolean;
  label: string;
  player: GameViewPlayer | undefined;
  profile: LobbyGamePlayer | undefined;
}

function PlayerPanel(props: PlayerPanelProps) {
  const { isCurrent = false, label, player, profile } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'PlayerPanel',
  });

  return (
    <article className={classes.playerPanel} data-current={isCurrent}>
      {profile === undefined ? (
        <span aria-hidden="true" className={classes.emptyAvatar} />
      ) : (
        <UserAvatar size="large" user={profile} />
      )}
      <div>
        <span>{label}</span>
        <strong>
          {profile?.displayName ??
            (player === undefined
              ? t('empty')
              : t('playerFallback', { playerId: player.id.slice(0, 8) }))}
        </strong>
        <small>
          {player === undefined
            ? t('noPlayer')
            : t(getPresenceLabelKey(player))}
        </small>
      </div>
    </article>
  );
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

function getSynchronizationLabelKey(status: string) {
  if (status === 'ready') {
    return 'synchronization.ready' as const;
  }

  return status === 'desynchronized'
    ? ('synchronization.desynchronized' as const)
    : ('synchronization.pending' as const);
}

function getPresenceLabelKey(player: GameViewPlayer) {
  if (player.presence === 'connected') {
    return player.team === 'white'
      ? ('whiteTeam' as const)
      : ('blackTeam' as const);
  }

  return player.presence === 'disconnected'
    ? ('disconnected' as const)
    : ('left' as const);
}

interface TurnDescriptionInput {
  currentPlayerId: string | null;
  isSpectator: boolean;
  userId: string;
}

function getTurnDescriptionKey(input: TurnDescriptionInput) {
  if (input.isSpectator) {
    return 'actionsDescriptionSpectator' as const;
  }

  return input.currentPlayerId === input.userId
    ? ('actionsDescriptionYou' as const)
    : ('actionsDescriptionOpponent' as const);
}
