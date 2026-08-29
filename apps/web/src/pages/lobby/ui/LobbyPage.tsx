import { useQueryClient } from '@tanstack/react-query';
import type { LobbyGame, LobbyGamePlayer } from '@war-chest/api-contracts';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { LOBBY_GAMES_QUERY_KEY, useLobbyGamesQuery } from '#/entities/game';
import { UserAvatar } from '#/entities/user';
import {
  createSelectedLobbyConnection,
  useApiErrorMessage,
} from '#/shared/api';
import {
  appRoutes,
  getActiveGamePageUrl,
  getGamePageUrl,
} from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import classes from './LobbyPage.module.scss';

export function LobbyPage() {
  const { t } = useTranslation('pages/lobby', {
    keyPrefix: 'LobbyPage',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuthSession();
  const userId = session?.user.id ?? '';
  const lobbyGamesQuery = useLobbyGamesQuery();
  const games = lobbyGamesQuery.data?.items ?? [];
  const currentPlayerGameId = lobbyGamesQuery.data?.currentPlayerGameId ?? null;
  const currentPlayerGame = games.find(
    (game) => game.id === currentPlayerGameId
  );

  useEffect(() => {
    if (userId === '') {
      return;
    }

    let isCancelled = false;
    let disconnect: (() => void) | undefined;

    void connectToLobby();

    return () => {
      isCancelled = true;
      disconnect?.();
    };

    async function connectToLobby(): Promise<void> {
      const connection = await createSelectedLobbyConnection({
        onSubscribed: refreshLobby,
        onUpdated: refreshLobby,
      });

      if (isCancelled) {
        connection.disconnect();
        return;
      }

      disconnect = connection.disconnect;
      connection.connect();

      function refreshLobby(): void {
        void queryClient.invalidateQueries({
          queryKey: LOBBY_GAMES_QUERY_KEY,
        });
      }
    }
  }, [queryClient, userId]);

  return (
    <main className={classes.page}>
      <section className={classes.hero}>
        <div>
          <p className={classes.eyebrow}>{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p>{t('description')}</p>
        </div>
        {currentPlayerGameId === null ? (
          <Button onClick={() => void navigate(appRoutes.games.new.url())}>
            {t('newGame')}
          </Button>
        ) : (
          <Button
            onClick={() =>
              void navigate(
                currentPlayerGame?.status === 'active'
                  ? getActiveGamePageUrl(currentPlayerGameId)
                  : getGamePageUrl(currentPlayerGameId)
              )
            }
          >
            {t('returnToGame')}
          </Button>
        )}
      </section>

      {lobbyGamesQuery.isPending ? (
        <section className={classes.state}>
          <LoadingIndicator label={t('loading')} />
        </section>
      ) : null}

      {lobbyGamesQuery.isError ? (
        <section className={classes.state}>
          <p className={classes.error} role="alert">
            {getApiErrorMessage(lobbyGamesQuery.error)}
          </p>
          <Button onClick={() => void lobbyGamesQuery.refetch()}>
            {t('retry')}
          </Button>
        </section>
      ) : null}

      {!lobbyGamesQuery.isPending && !lobbyGamesQuery.isError ? (
        games.length === 0 ? (
          <section className={classes.state}>
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyDescription')}</p>
          </section>
        ) : (
          <section aria-label={t('activeGames')} className={classes.games}>
            {games.map((game) => (
              <GameCard
                game={game}
                key={game.id}
                onOpen={() =>
                  void navigate(
                    game.status === 'active'
                      ? getActiveGamePageUrl(game.id)
                      : getGamePageUrl(game.id)
                  )
                }
              />
            ))}
          </section>
        )
      ) : null}
    </main>
  );
}

interface GameCardProps {
  game: LobbyGame;
  onOpen(this: void): void;
}

function GameCard(props: GameCardProps) {
  const { game, onOpen } = props;
  const { i18n, t } = useTranslation('pages/lobby', {
    keyPrefix: 'GameCard',
  });
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.resolvedLanguage]
  );
  const whitePlayer = game.players.find((player) => player.team === 'white');
  const blackPlayer = game.players.find((player) => player.team === 'black');

  return (
    <article className={classes.gameCard}>
      <div className={classes.gameHeader}>
        <span className={classes.status} data-status={game.status}>
          {game.status === 'waiting' ? t('statusWaiting') : t('statusActive')}
        </span>
        <div className={classes.gameHeaderActions}>
          <time dateTime={game.createdAt}>
            {dateFormatter.format(new Date(game.createdAt))}
          </time>
          <Button
            aria-label={t('openGame')}
            className={classes.openGameButton}
            onClick={onOpen}
            title={t('openGame')}
            variant="secondary"
          >
            <svg
              aria-hidden="true"
              className={classes.openGameIcon}
              viewBox="0 0 24 24"
            >
              <path d="M14 5h5v5M19 5l-9 9M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </Button>
        </div>
      </div>
      <div className={classes.teams}>
        <TeamSlot name={t('whiteTeam')} player={whitePlayer} />
        <span aria-hidden="true" className={classes.versus}>
          VS
        </span>
        <TeamSlot name={t('blackTeam')} player={blackPlayer} />
      </div>
    </article>
  );
}

interface TeamSlotProps {
  name: string;
  player: LobbyGamePlayer | undefined;
}

function TeamSlot(props: TeamSlotProps) {
  const { name, player } = props;
  const { t } = useTranslation('pages/lobby', {
    keyPrefix: 'TeamSlot',
  });

  return (
    <div className={classes.teamSlot}>
      <span>{name}</span>
      <div className={classes.playerIdentity}>
        {player === undefined ? null : (
          <UserAvatar size="small" user={player} />
        )}
        <strong>{player?.displayName ?? t('available')}</strong>
      </div>
    </div>
  );
}
