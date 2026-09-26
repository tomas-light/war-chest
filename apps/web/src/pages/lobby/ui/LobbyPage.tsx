import type { LobbyGame, LobbyGamePlayer } from '@war-chest/api-contracts';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { useLobbyGamesConnection, useLobbyGamesQuery } from '#/entities/game';
import { UserAvatar, UserProfileLink } from '#/entities/user';
import {
  appRoutes,
  getActiveGamePageUrl,
  getGamePageUrl,
} from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import {
  type GameSummaryTeam,
  GameSummaryCard,
} from '#/shared/ui/game-summary-card';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import classes from './LobbyPage.module.scss';

export function LobbyPage() {
  const { t } = useTranslation('pages/lobby', {
    keyPrefix: 'LobbyPage',
  });

  const navigate = useNavigate();

  const { session } = useAuthSession();
  const userId = session?.user.id ?? '';
  useLobbyGamesConnection(userId);

  const {
    data: lobbyGames,
    error: lobbyGamesError,
    isError: isLobbyGamesError,
    isPending: isLobbyGamesPending,
    refetch: refetchLobbyGames,
  } = useLobbyGamesQuery();

  const games = lobbyGames?.items ?? [];
  const currentPlayerGameId = lobbyGames?.currentPlayerGameId ?? null;
  const currentPlayerGame = games.find(
    (game) => game.id === currentPlayerGameId
  );

  return (
    <main
      className={classes.page}
      data-empty={
        !isLobbyGamesPending && !isLobbyGamesError && games.length === 0
      }
    >
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

      {isLobbyGamesPending ? (
        <section className={classes.state}>
          <LoadingIndicator label={t('loading')} />
        </section>
      ) : null}

      {isLobbyGamesError ? (
        <section className={classes.state}>
          <p className={classes.error} role="alert">
            {lobbyGamesError}
          </p>
          <Button onClick={() => void refetchLobbyGames()}>{t('retry')}</Button>
        </section>
      ) : null}

      {!isLobbyGamesPending && !isLobbyGamesError ? (
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
  const seatNumbers = game.settings.format === 'duel' ? [1] : [1, 2];
  const teams: readonly [GameSummaryTeam, GameSummaryTeam] = [
    {
      members: seatNumbers.map((seat) => {
        const player = game.players.find(
          (item) => item.team === 'white' && item.seat === seat
        );

        return {
          content: <LobbyPlayer player={player} />,
          id: player?.id ?? `white-${seat}-available`,
        };
      }),
      name: t('whiteTeam'),
    },
    {
      members: seatNumbers.map((seat) => {
        const player = game.players.find(
          (item) => item.team === 'black' && item.seat === seat
        );

        return {
          content: <LobbyPlayer player={player} />,
          id: player?.id ?? `black-${seat}-available`,
        };
      }),
      name: t('blackTeam'),
    },
  ];

  return (
    <GameSummaryCard
      action={
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
      }
      actionPlacement="header"
      dateLabel={dateFormatter.format(new Date(game.createdAt))}
      dateTime={game.createdAt}
      description={
        <p>
          {t('configuration', {
            format: t(`format.${game.settings.format}`),
            selection: t(`selection.${game.settings.cardSelectionMode}`),
          })}
        </p>
      }
      heading={
        game.status === 'waiting' ? t('statusWaiting') : t('statusActive')
      }
      headingTone={game.status}
      teams={teams}
      versusLabel="VS"
    />
  );
}

interface LobbyPlayerProps {
  player: LobbyGamePlayer | undefined;
}

function LobbyPlayer(props: LobbyPlayerProps) {
  const { player } = props;
  const { t } = useTranslation('pages/lobby', {
    keyPrefix: 'TeamSlot',
  });

  return (
    <div className={classes.playerIdentity}>
      {player === undefined ? null : <UserAvatar size="small" user={player} />}
      <strong>
        {player === undefined ? (
          t('available')
        ) : (
          <UserProfileLink user={player} />
        )}
      </strong>
    </div>
  );
}
