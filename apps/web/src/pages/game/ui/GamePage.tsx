import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameView, GameViewPlayer } from '@war-chest/game-engine';
import { useState } from 'react';
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

  return (
    <main className={classes.page}>
      <section className={classes.gameShell}>
        <header className={classes.header}>
          <div>
            <p className={classes.eyebrow}>
              {t(
                getRoleLabelKey({
                  hasAnotherPlayerGame,
                  isCreator,
                  isPlayer,
                  isRoleSelectionOpen,
                })
              )}
            </p>
            <h1>{t(getStatusTitleKey(liveState.status))}</h1>
            <p className={classes.gameId}>{t('gameLabel', { gameId })}</p>
          </div>
          <Button onClick={openLobby}>{t('backToLobby')}</Button>
        </header>

        <p className={classes.formatLine}>
          {t(`format.${liveState.settings.format}`)}
        </p>

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
          <div className={classes.versusActions}>
            <span aria-hidden="true" className={classes.versus}>
              VS
            </span>
            {isCreator &&
            isReadyToStart &&
            liveState.settings.format === 'duel' ? (
              <SwapPlayerPositionsButton
                gameId={gameId}
                onSwapped={hydrateGame}
                view={liveState}
              />
            ) : null}
          </div>
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

        <div className={classes.runtimeStatus}>
          <span data-ready={synchronizationStatus === 'ready'}>
            {t(getSynchronizationLabelKey(synchronizationStatus))}
          </span>
          {connectionError === null || isLeavingGame ? null : (
            <p role="alert">{getApiErrorMessage(connectionError)}</p>
          )}
        </div>

        {isRoleSelectionOpen ? (
          <section className={classes.spectatorChoice}>
            <div>
              <h2>{t('roleChoiceTitle')}</h2>
              <p>
                {canChoosePosition
                  ? t('roleChoiceDescription')
                  : t('roleChoiceFullDescription')}
              </p>
            </div>
            <div className={classes.roleActions}>
              <Button onClick={openSpectatorMode} variant="secondary">
                {t('watch')}
              </Button>
            </div>
          </section>
        ) : null}

        {liveState.status === 'waiting' && !isPlayer && isSpectatorMode ? (
          <p className={classes.notice}>
            {isReadyToStart
              ? t('spectatorReadyNotice')
              : t('spectatorWaitingNotice')}
          </p>
        ) : null}

        {!isPlayer && hasAnotherPlayerGame ? (
          <section className={classes.spectatorChoice}>
            <div>
              <h2>{t('ownGameTitle')}</h2>
              <p>{t('ownGameDescription')}</p>
            </div>
            <Button
              onClick={() => void navigate(getGamePageUrl(currentPlayerGameId))}
              variant="secondary"
            >
              {t('returnToOwnGame')}
            </Button>
          </section>
        ) : null}

        {liveState.status === 'waiting' &&
        isPlayer &&
        !isCreator &&
        isReadyToStart ? (
          <p className={classes.notice}>{t('creatorReadyNotice')}</p>
        ) : null}

        {liveState.status === 'waiting' && isCreator && isReadyToStart ? (
          <StartGameButton
            gameId={gameId}
            onStarted={hydrateGame}
            view={liveState}
          />
        ) : null}

        {isCreator || isPlayer ? (
          <LeaveGameButton
            gameId={gameId}
            isCreator={isCreator}
            onLeaveFailed={stopLeavingGame}
            onLeaving={startLeavingGame}
            onLeft={openLobby}
            view={liveState}
          />
        ) : null}
      </section>
    </main>
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

  return (
    <section className={classes.teamPositions}>
      <h2>{team === 'white' ? t('whiteTeam') : t('blackTeam')}</h2>
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
  const playerFallback =
    player === undefined
      ? t('available')
      : t('playerFallback', { playerId: player.id.slice(0, 8) });
  const playerName = profile?.displayName ?? playerFallback;

  return (
    <article className={classes.position} data-occupied={player !== undefined}>
      <span>{t('seat', { seat })}</span>
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
      {player === undefined && canJoin ? (
        <div className={classes.positionAction}>
          <JoinGameButton
            gameId={gameId}
            onJoined={onJoined}
            seat={seat}
            team={team}
            view={view}
          />
        </div>
      ) : null}
    </article>
  );
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
    <main className={classes.page}>
      <section className={classes.state}>
        <h1>{t('title')}</h1>
        <p role="alert">{message}</p>
        <Button onClick={onBack}>{t('backToLobby')}</Button>
      </section>
    </main>
  );
}

interface RoleLabelInput {
  hasAnotherPlayerGame: boolean;
  isCreator: boolean;
  isPlayer: boolean;
  isRoleSelectionOpen: boolean;
}

function getRoleLabelKey(input: RoleLabelInput) {
  if (input.hasAnotherPlayerGame) {
    return 'role.spectator' as const;
  }
  if (input.isRoleSelectionOpen) {
    return 'role.select' as const;
  }

  if (input.isCreator) {
    return 'role.creator' as const;
  }

  if (!input.isPlayer) {
    return 'role.spectator' as const;
  }

  return 'role.participant' as const;
}

function getStatusTitleKey(status: GameView['status']) {
  if (status === 'waiting') {
    return 'status.waiting' as const;
  }

  return status === 'active'
    ? ('status.active' as const)
    : ('status.finished' as const);
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
