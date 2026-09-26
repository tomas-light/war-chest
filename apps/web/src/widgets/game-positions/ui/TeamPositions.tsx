import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameView, GameViewPlayer } from '@war-chest/game-engine';
import { UserAvatar, UserProfileLink } from '#/entities/user';
import { JoinGameButton } from '#/features/join-game';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './TeamPositions.module.scss';

interface TeamPositionsProps {
  canJoin: boolean;
  gameId: string;
  onJoined(this: void, view: GameView): void;
  profiles: readonly LobbyGamePlayer[];
  team: 'black' | 'white';
  userId: string;
  view: GameView;
}

export function TeamPositions(props: TeamPositionsProps) {
  const { canJoin, gameId, onJoined, profiles, team, userId, view } = props;
  const { t } = useTranslation('widgets/game-positions', {
    keyPrefix: 'TeamPositions',
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
  const { t } = useTranslation('widgets/game-positions', {
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

function getPresenceLabelKey(player: GameViewPlayer) {
  if (player.presence === 'connected') {
    return 'connected' as const;
  }

  return player.presence === 'disconnected'
    ? ('disconnected' as const)
    : ('left' as const);
}
