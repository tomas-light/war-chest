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
import {
  type GameSummaryTeam,
  GameSummaryCard,
} from '#/shared/ui/game-summary-card';
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
    <main
      className={classes.page}
      data-empty={
        !gamesQuery.isPending && !gamesQuery.isError && games.length === 0
      }
    >
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
  const { t: tTeam } = useTranslation('pages/user-game-history', {
    keyPrefix: 'Team',
  });
  const whitePlayers = game.participants.filter(
    (participant) => participant.team === 'white'
  );
  const blackPlayers = game.participants.filter(
    (participant) => participant.team === 'black'
  );
  const teams: readonly [GameSummaryTeam, GameSummaryTeam] = [
    {
      isWinner: game.winnerTeam === 'white',
      members: whitePlayers.map((player) => ({
        content: <HistoryPlayer player={player} />,
        id: player.id,
      })),
      name: t('whiteTeam'),
    },
    {
      isWinner: game.winnerTeam === 'black',
      members: blackPlayers.map((player) => ({
        content: <HistoryPlayer player={player} />,
        id: player.id,
      })),
      name: t('blackTeam'),
    },
  ];

  return (
    <GameSummaryCard
      action={
        <Link
          className={classes.primaryAction}
          to={appRoutes.history.gameId(game.id).url()}
        >
          {t('viewGame')}
        </Link>
      }
      dateLabel={dateFormatter.format(new Date(game.finishedAt))}
      dateTime={game.finishedAt}
      description={
        <p>
          {t('yourTeam', {
            team: game.team === 'white' ? t('whiteTeam') : t('blackTeam'),
          })}
          {' · '}
          {t('configuration', {
            format: t(`format.${game.settings.format}`),
            selection: t(`selection.${game.settings.cardSelectionMode}`),
          })}
        </p>
      }
      heading={game.result === 'victory' ? t('victory') : t('defeat')}
      headingTone={game.result}
      teams={teams}
      versusLabel="VS"
      winnerLabel={tTeam('winner')}
    />
  );
}

interface HistoryPlayerProps {
  player: UserGameParticipant;
}

function HistoryPlayer(props: HistoryPlayerProps) {
  const { player } = props;
  const { t } = useTranslation('pages/user-game-history', {
    keyPrefix: 'Team',
  });

  return (
    <div className={classes.player}>
      <UserAvatar size="small" user={player} />
      <div>
        <UserProfileLink user={player} />
        <small>{t('seat', { seat: player.seat })}</small>
      </div>
    </div>
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
