import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameView, GameViewPlayer } from '@war-chest/game-engine';
import { type ReactNode, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { UserAvatar, UserProfileLink } from '#/entities/user';
import { JoinGameButton } from '#/features/join-game';
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
    gameQuery,
    hydrateGame,
    isLobbyPending,
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

interface TeamPositionsProps {
  canJoin: boolean;
  gameId: string;
  onJoined(this: void, view: GameView): void;
  profiles: readonly LobbyGamePlayer[];
  team: 'black' | 'white';
  userId: string;
  view: GameView;
}

function TeamPositions(props: TeamPositionsProps) {
  const { canJoin, gameId, onJoined, profiles, team, userId, view } = props;
  const { t } = useTranslation('pages/game', {
    keyPrefix: 'GamePage',
  });
  const seatNumbers = view.settings.format === 'duel' ? [1] : [1, 2];
  const isTeam = view.settings.format === 'team';

  return (
    <section className={classes.teamPositions}>
      {isTeam ? (
        <h2>{team === 'white' ? t('whiteTeam') : t('blackTeam')}</h2>
      ) : null}
      {seatNumbers.map((seat) => (
        <PlayerPosition
          canJoin={canJoin}
          gameId={gameId}
          key={seat}
          onJoined={onJoined}
          player={view.players.find(
            (player) => player.team === team && player.seat === seat
          )}
          profile={profiles.find(
            (player) => player.team === team && player.seat === seat
          )}
          seat={seat}
          team={team}
          userId={userId}
          view={view}
        />
      ))}
    </section>
  );
}

interface PlayerPositionProps {
  canJoin: boolean;
  gameId: string;
  onJoined(this: void, view: GameView): void;
  player: GameViewPlayer | undefined;
  profile: LobbyGamePlayer | undefined;
  seat: number;
  team: 'black' | 'white';
  userId: string;
  view: GameView;
}

function PlayerPosition(props: PlayerPositionProps) {
  const {
    canJoin,
    gameId,
    onJoined,
    player,
    profile,
    seat,
    team,
    userId,
    view,
  } = props;
  const { t } = useTranslation('pages/game', {
    keyPrefix: 'PlayerPosition',
  });
  const isCurrentUser = player?.id === userId;
  const isTeam = view.settings.format === 'team';
  const playerFallback =
    player === undefined
      ? t('available')
      : t('playerFallback', { playerId: player.id.slice(0, 8) });
  const playerName = profile?.displayName ?? playerFallback;

  return (
    <article className={classes.position} data-occupied={player !== undefined}>
      <span>{getPositionLabel()}</span>
      <div className={classes.playerIdentity}>
        {profile === undefined ? null : (
          <UserAvatar size="medium" user={profile} />
        )}
        <strong>
          {profile === undefined ? (
            playerName
          ) : (
            <UserProfileLink user={profile}>
              {isCurrentUser
                ? t('youLabel', { playerName: profile.displayName })
                : profile.displayName}
            </UserProfileLink>
          )}
        </strong>
      </div>
      <small>
        {player === undefined
          ? t('available')
          : t(getPresenceLabelKey(player), { seat })}
      </small>
      <div className={classes.positionAction}>
        {player === undefined && canJoin ? (
          <JoinGameButton
            gameId={gameId}
            onJoined={onJoined}
            seat={seat}
            team={team}
            view={view}
          />
        ) : (
          <span aria-hidden="true" className={classes.positionActionSlot} />
        )}
      </div>
    </article>
  );

  function getPositionLabel(): string {
    if (isTeam) {
      return t('seat', { seat });
    }

    if (team === 'white') {
      return t('whiteTeam');
    }

    return t('blackTeam');
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

function getPresenceLabelKey(player: GameViewPlayer) {
  if (player.presence === 'connected') {
    return 'connected' as const;
  }

  return player.presence === 'disconnected'
    ? ('disconnected' as const)
    : ('left' as const);
}
