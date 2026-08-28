import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameViewPlayer } from '@war-chest/game-engine';
import { Navigate, useNavigate } from 'react-router';
import { UserAvatar } from '#/entities/user';
import { appRoutes, getGamePageUrl } from '#/shared/config';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import { useGameRuntime } from '#/widgets/game-runtime';
import classes from './ActiveGamePage.module.scss';

export function ActiveGamePage() {
  const navigate = useNavigate();
  const {
    connectionError,
    gameId,
    gameQuery,
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
          <LoadingIndicator label="Подключаемся к игровому столу…" />
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

  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <div>
          <p className={classes.eyebrow}>
            {isSpectator ? 'Режим зрителя' : 'Игровой стол'}
          </p>
          <h1>
            {liveState.status === 'finished' ? 'Партия завершена' : 'Игра'}
          </h1>
          <p className={classes.gameId}>Игра {gameId}</p>
        </div>
        <Button onClick={openLobby}>Вернуться в лобби</Button>
      </header>

      <div className={classes.runtimeStatus}>
        <span data-ready={synchronizationStatus === 'ready'}>
          {getSynchronizationLabel(synchronizationStatus)}
        </span>
        {connectionError === null ? null : (
          <p role="alert">{connectionError}</p>
        )}
      </div>

      <div className={classes.layout}>
        <section aria-label="Игровое поле" className={classes.tableArea}>
          <PlayerPanel
            label={isSpectator ? 'Игрок сверху' : 'Оппонент'}
            player={topPlayer}
            profile={findProfile(topPlayer)}
          />

          <div className={classes.boardPlaceholder}>
            <span>Игровое поле</span>
            <p>Здесь будет размещено поле War Chest.</p>
          </div>

          <PlayerPanel
            isCurrent={!isSpectator}
            label={isSpectator ? 'Игрок снизу' : 'Вы'}
            player={bottomPlayer}
            profile={findProfile(bottomPlayer)}
          />
        </section>

        <aside className={classes.sidebar}>
          <section className={classes.sidebarSection}>
            <p className={classes.sidebarEyebrow}>Ход</p>
            <h2>Доступные действия</h2>
            <p>
              {getTurnDescription(
                liveState.currentPlayerId,
                userId,
                isSpectator
              )}
            </p>
            <div className={classes.placeholderActions}>
              <Button disabled>Выбрать отряд</Button>
              <Button disabled variant="secondary">
                Завершить действие
              </Button>
            </div>
          </section>

          <section className={classes.sidebarSection}>
            <p className={classes.sidebarEyebrow}>Журнал</p>
            <h2>История ходов</h2>
            <p>Панель истории появится здесь после реализации игровых ходов.</p>
            <Button disabled variant="secondary">
              Открыть историю
            </Button>
          </section>
        </aside>
      </div>
    </main>
  );

  function findProfile(
    player: GameViewPlayer | undefined
  ): LobbyGamePlayer | undefined {
    return lobbyGame?.players.find((profile) => profile.id === player?.id);
  }

  function openLobby(): void {
    void navigate(appRoutes.lobby.url());
  }
}

interface PlayerPanelProps {
  isCurrent?: boolean;
  label: string;
  player: GameViewPlayer | undefined;
  profile: LobbyGamePlayer | undefined;
}

function PlayerPanel(props: PlayerPanelProps) {
  const { isCurrent = false, label, player, profile } = props;

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
              ? 'Место свободно'
              : `Игрок ${player.id.slice(0, 8)}`)}
        </strong>
        <small>
          {player === undefined ? 'Нет игрока' : getPresenceLabel(player)}
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

  return (
    <main className={classes.page}>
      <section className={classes.state}>
        <h1>Не удалось открыть игровой стол</h1>
        <p role="alert">{message}</p>
        <Button onClick={onBack}>Вернуться в лобби</Button>
      </section>
    </main>
  );
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
    return player.team === 'white' ? 'Белая команда' : 'Чёрная команда';
  }

  return player.presence === 'disconnected'
    ? 'Соединение потеряно'
    : 'Покинул игру';
}

function getTurnDescription(
  currentPlayerId: string | null,
  userId: string,
  isSpectator: boolean
): string {
  if (isSpectator) {
    return 'Действия недоступны в режиме зрителя.';
  }

  return currentPlayerId === userId
    ? 'Сейчас ваш ход.'
    : 'Ожидаем ход оппонента.';
}
