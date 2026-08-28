import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameView, GameViewPlayer } from '@war-chest/game-engine';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { UserAvatar } from '#/entities/user';
import { JoinGamePanel } from '#/features/join-game';
import { StartGameButton } from '#/features/start-game';
import { SwapPlayerPositionsButton } from '#/features/swap-player-positions';
import {
  appRoutes,
  getActiveGamePageUrl,
  getGamePageUrl,
} from '#/shared/config';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import { useGameRuntime } from '#/widgets/game-runtime';
import classes from './GamePage.module.scss';

export function GamePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    connectionError,
    currentPlayerGameId,
    gameId,
    gameQuery,
    hydrateGame,
    isLobbyPending,
    liveState,
    lobbyGame,
    synchronizationStatus,
    userId,
  } = useGameRuntime();

  if (gameId === '') {
    return <GameError message="Игра не выбрана." onBack={openLobby} />;
  }

  if (liveState === null && gameQuery.isPending) {
    return (
      <main className={classes.page}>
        <section className={classes.state}>
          <LoadingIndicator label="Подключаемся к игре…" />
        </section>
      </main>
    );
  }

  if (liveState === null && gameQuery.isError) {
    return <GameError message={gameQuery.error.message} onBack={openLobby} />;
  }

  if (liveState === null) {
    return (
      <GameError message="Состояние игры недоступно." onBack={openLobby} />
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
  const isReadyToStart = liveState.players.length === 2;
  const hasAnotherPlayerGame =
    currentPlayerGameId !== null && currentPlayerGameId !== gameId;
  const isPositionSelectionOpen = searchParams.get('mode') === 'join';
  const isSpectatorMode = searchParams.get('mode') === 'watch';
  const canChoosePosition =
    !isLobbyPending && !hasAnotherPlayerGame && !isReadyToStart;
  const isRoleSelectionOpen =
    !isPlayer &&
    !(isCreator && isReadyToStart) &&
    !hasAnotherPlayerGame &&
    !isLobbyPending &&
    !isPositionSelectionOpen &&
    !isSpectatorMode;

  return (
    <main className={classes.page}>
      <section className={classes.gameShell}>
        <header className={classes.header}>
          <div>
            <p className={classes.eyebrow}>
              {getRoleLabel(
                hasAnotherPlayerGame,
                isCreator,
                isPlayer,
                isRoleSelectionOpen
              )}
            </p>
            <h1>{getStatusTitle(liveState)}</h1>
            <p className={classes.gameId}>Игра {gameId}</p>
          </div>
          <Button onClick={openLobby}>Вернуться в лобби</Button>
        </header>

        <div className={classes.positions}>
          <PlayerPosition
            player={liveState.players.find((player) => player.team === 'white')}
            profile={lobbyGame?.players.find(
              (player) => player.team === 'white'
            )}
            team="Белая команда"
            userId={userId}
          />
          <div className={classes.versusActions}>
            <span aria-hidden="true" className={classes.versus}>
              VS
            </span>
            {isCreator && isReadyToStart ? (
              <SwapPlayerPositionsButton
                gameId={gameId}
                onSwapped={hydrateGame}
                userId={userId}
                view={liveState}
              />
            ) : null}
          </div>
          <PlayerPosition
            player={liveState.players.find((player) => player.team === 'black')}
            profile={lobbyGame?.players.find(
              (player) => player.team === 'black'
            )}
            team="Чёрная команда"
            userId={userId}
          />
        </div>

        <div className={classes.runtimeStatus}>
          <span data-ready={synchronizationStatus === 'ready'}>
            {getSynchronizationLabel(synchronizationStatus)}
          </span>
          {connectionError === null ? null : (
            <p role="alert">{connectionError}</p>
          )}
        </div>

        {canChoosePosition && (isPlayer || isPositionSelectionOpen) ? (
          <JoinGamePanel
            gameId={gameId}
            onJoined={hydrateGame}
            userId={userId}
            view={liveState}
          />
        ) : null}

        {isRoleSelectionOpen ? (
          <section className={classes.spectatorChoice}>
            <div>
              <h2>Как открыть игру?</h2>
              <p>
                {canChoosePosition
                  ? 'Можно наблюдать за подготовкой или занять свободное место.'
                  : 'Все места заняты, поэтому игра доступна только для наблюдения.'}
              </p>
            </div>
            <div className={classes.roleActions}>
              <Button onClick={openSpectatorMode} variant="secondary">
                Смотреть
              </Button>
              {canChoosePosition ? (
                <Button onClick={openPositionSelection}>Занять место</Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {liveState.status === 'waiting' && !isPlayer && isSpectatorMode ? (
          <p className={classes.notice}>
            {isReadyToStart
              ? 'Все места заняты. Вы наблюдаете за подготовкой, а игру запустит её создатель.'
              : 'Вы наблюдаете за подготовкой. Пока есть свободное место, к игре можно присоединиться.'}
          </p>
        ) : null}

        {!isPlayer && hasAnotherPlayerGame ? (
          <section className={classes.spectatorChoice}>
            <div>
              <h2>Вы смотрите как зритель</h2>
              <p>
                Пока текущая партия не завершена, занять место в другой игре
                нельзя.
              </p>
            </div>
            <Button
              onClick={() => void navigate(getGamePageUrl(currentPlayerGameId))}
              variant="secondary"
            >
              Вернуться в свою игру
            </Button>
          </section>
        ) : null}

        {liveState.status === 'waiting' &&
        isPlayer &&
        !isCreator &&
        isReadyToStart ? (
          <p className={classes.notice}>
            Все места заняты. Ожидаем, пока создатель запустит игру.
          </p>
        ) : null}

        {liveState.status === 'waiting' && isCreator && isReadyToStart ? (
          <StartGameButton
            gameId={gameId}
            onStarted={hydrateGame}
            userId={userId}
            view={liveState}
          />
        ) : null}
      </section>
    </main>
  );

  function openLobby(): void {
    void navigate(appRoutes.lobby.url());
  }

  function openPositionSelection(): void {
    setSearchParams({ mode: 'join' });
  }

  function openSpectatorMode(): void {
    setSearchParams({ mode: 'watch' });
  }
}

interface PlayerPositionProps {
  player: GameViewPlayer | undefined;
  profile: LobbyGamePlayer | undefined;
  team: string;
  userId: string;
}

function PlayerPosition(props: PlayerPositionProps) {
  const { player, profile, team, userId } = props;
  const isCurrentUser = player?.id === userId;

  return (
    <article className={classes.position} data-occupied={player !== undefined}>
      <span>{team}</span>
      <div className={classes.playerIdentity}>
        {profile === undefined ? null : (
          <UserAvatar size="medium" user={profile} />
        )}
        <strong>
          {player === undefined
            ? 'Свободно'
            : isCurrentUser
              ? `${profile?.displayName ?? 'Вы'} · Вы`
              : (profile?.displayName ?? `Игрок ${player.id.slice(0, 8)}`)}
        </strong>
      </div>
      <small>
        {player === undefined ? 'Место 1' : getPresenceLabel(player)}
      </small>
    </article>
  );
}

interface GameErrorProps {
  message: string;
  onBack(this: void): void;
}

function GameError(props: GameErrorProps) {
  const { message, onBack } = props;

  return (
    <main className={classes.page}>
      <section className={classes.state}>
        <h1>Не удалось открыть игру</h1>
        <p role="alert">{message}</p>
        <Button onClick={onBack}>Вернуться в лобби</Button>
      </section>
    </main>
  );
}

function getRoleLabel(
  hasAnotherPlayerGame: boolean,
  isCreator: boolean,
  isPlayer: boolean,
  isRoleSelectionOpen: boolean
): string {
  if (hasAnotherPlayerGame) {
    return 'Режим зрителя';
  }
  if (isRoleSelectionOpen) {
    return 'Выберите режим';
  }

  if (isCreator) {
    return 'Вы создали игру';
  }

  if (!isPlayer) {
    return 'Режим зрителя';
  }

  return 'Вы участвуете в игре';
}

function getStatusTitle(view: GameView): string {
  if (view.status === 'waiting') {
    return 'Подготовка партии';
  }

  return view.status === 'active' ? 'Активная игра' : 'Игра завершена';
}

function getSynchronizationLabel(status: string): string {
  if (status === 'ready') {
    return 'Состояние синхронизировано';
  }

  return status === 'desynchronized'
    ? 'Восстанавливаем синхронизацию…'
    : 'Ожидаем состояние…';
}

function getPresenceLabel(player: GameViewPlayer): string {
  if (player.presence === 'connected') {
    return 'В сети · место 1';
  }

  return player.presence === 'disconnected'
    ? 'Соединение потеряно'
    : 'Покинул игру';
}
