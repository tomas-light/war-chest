import type {
  UserFinishedGame,
  UserGameParticipant,
} from '@war-chest/api-contracts';
import { type PropsWithChildren, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import {
  usePublicUserQuery,
  UserAvatar,
  UserProfileLink,
  useUserGamesQuery,
} from '#/entities/user';
import { useApiErrorMessage } from '#/shared/api';
import { appRoutes } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import classes from './UserGameHistoryPage.module.scss';

export function UserGameHistoryPage() {
  const { i18n, t } = useTranslation('pages/user-game-history', {
    keyPrefix: 'UserGameHistoryPage',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const { userId = '' } = useParams();
  const userQuery = usePublicUserQuery(userId);
  const gamesQuery = useUserGamesQuery(userId);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        dateStyle: 'long',
        timeStyle: 'short',
      }),
    [i18n.resolvedLanguage]
  );
  const games = gamesQuery.data?.pages.flatMap((page) => page.items) ?? [];

  if (userId === '') {
    return <HistoryError message={t('missingUser')} onRetry={undefined} />;
  }

  if (userQuery.isPending) {
    return <HistoryLoading label={t('loadingProfile')} />;
  }

  if (userQuery.isError) {
    return (
      <HistoryError
        message={getApiErrorMessage(userQuery.error)}
        onRetry={() => void userQuery.refetch()}
      />
    );
  }

  const user = userQuery.data;

  return (
    <main className={classes.page}>
      <header className={classes.header}>
        <div className={classes.profileIdentity}>
          <UserAvatar size="large" user={user} />
          <div>
            <p className={classes.eyebrow}>{t('eyebrow')}</p>
            <h1>{t('title', { userName: user.displayName })}</h1>
            <p className={classes.description}>{t('description')}</p>
          </div>
        </div>
        <Link
          className={classes.secondaryAction}
          to={appRoutes.users.userId(user.id).url()}
        >
          {t('backToProfile')}
        </Link>
      </header>

      <section aria-label={t('gamesList')} className={classes.history}>
        {gamesQuery.isPending ? (
          <HistoryInlineState>
            <LoadingIndicator label={t('loadingHistory')} />
          </HistoryInlineState>
        ) : null}

        {gamesQuery.isError && games.length === 0 ? (
          <HistoryInlineState>
            <p className={classes.error} role="alert">
              {getApiErrorMessage(gamesQuery.error)}
            </p>
            <Button onClick={() => void gamesQuery.refetch()}>
              {t('retry')}
            </Button>
          </HistoryInlineState>
        ) : null}

        {!gamesQuery.isPending && !gamesQuery.isError && games.length === 0 ? (
          <HistoryInlineState>
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyDescription')}</p>
          </HistoryInlineState>
        ) : null}

        {games.map((game) => (
          <GameCard dateFormatter={dateFormatter} game={game} key={game.id} />
        ))}

        {gamesQuery.isError && games.length > 0 ? (
          <div className={classes.paginationState}>
            <p className={classes.error} role="alert">
              {getApiErrorMessage(gamesQuery.error)}
            </p>
            <Button onClick={() => void gamesQuery.fetchNextPage()}>
              {t('retry')}
            </Button>
          </div>
        ) : null}

        {gamesQuery.hasNextPage && !gamesQuery.isError ? (
          <Button
            className={classes.loadMore}
            disabled={gamesQuery.isFetchingNextPage}
            onClick={() => void gamesQuery.fetchNextPage()}
            variant="secondary"
          >
            {gamesQuery.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
          </Button>
        ) : null}
      </section>
    </main>
  );
}

interface GameCardProps {
  dateFormatter: Intl.DateTimeFormat;
  game: UserFinishedGame;
}

function GameCard(props: GameCardProps) {
  const { dateFormatter, game } = props;
  const { t } = useTranslation('pages/user-game-history', {
    keyPrefix: 'GameCard',
  });
  const whitePlayers = game.participants.filter(
    (participant) => participant.team === 'white'
  );
  const blackPlayers = game.participants.filter(
    (participant) => participant.team === 'black'
  );

  return (
    <article className={classes.gameCard}>
      <header className={classes.gameHeader}>
        <div>
          <span className={classes.result} data-result={game.result}>
            {game.result === 'victory' ? t('victory') : t('defeat')}
          </span>
          <p>
            {t('yourTeam', {
              team: game.team === 'white' ? t('whiteTeam') : t('blackTeam'),
            })}
          </p>
        </div>
        <time dateTime={game.finishedAt}>
          {dateFormatter.format(new Date(game.finishedAt))}
        </time>
      </header>

      <div className={classes.teams}>
        <Team
          isWinner={game.winnerTeam === 'white'}
          name={t('whiteTeam')}
          players={whitePlayers}
        />
        <span aria-hidden="true" className={classes.versus}>
          VS
        </span>
        <Team
          isWinner={game.winnerTeam === 'black'}
          name={t('blackTeam')}
          players={blackPlayers}
        />
      </div>

      <Link
        className={classes.primaryAction}
        to={appRoutes.history.gameId(game.id).url()}
      >
        {t('viewGame')}
      </Link>
    </article>
  );
}

interface TeamProps {
  isWinner: boolean;
  name: string;
  players: readonly UserGameParticipant[];
}

function Team(props: TeamProps) {
  const { isWinner, name, players } = props;
  const { t } = useTranslation('pages/user-game-history', {
    keyPrefix: 'Team',
  });

  return (
    <section className={classes.team} data-winner={isWinner}>
      <div className={classes.teamHeader}>
        <h3>{name}</h3>
        {isWinner ? <span>{t('winner')}</span> : null}
      </div>
      <ul>
        {players.map((player) => (
          <li key={player.id}>
            <UserAvatar size="small" user={player} />
            <div>
              <UserProfileLink user={player} />
              <small>{t('seat', { seat: player.seat })}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistoryInlineState(props: PropsWithChildren) {
  return <div className={classes.inlineState}>{props.children}</div>;
}

interface HistoryLoadingProps {
  label: string;
}

function HistoryLoading(props: HistoryLoadingProps) {
  return (
    <main className={classes.page}>
      <div className={classes.pageState}>
        <LoadingIndicator label={props.label} />
      </div>
    </main>
  );
}

interface HistoryErrorProps {
  message: string;
  onRetry: VoidFunction | undefined;
}

function HistoryError(props: HistoryErrorProps) {
  const { message, onRetry } = props;
  const { t } = useTranslation('pages/user-game-history', {
    keyPrefix: 'HistoryError',
  });

  return (
    <main className={classes.page}>
      <div className={classes.pageState}>
        <h1>{t('title')}</h1>
        <p className={classes.error} role="alert">
          {message}
        </p>
        {onRetry === undefined ? null : (
          <Button onClick={onRetry}>{t('retry')}</Button>
        )}
      </div>
    </main>
  );
}
