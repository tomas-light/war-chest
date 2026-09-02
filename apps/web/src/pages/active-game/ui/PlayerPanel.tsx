import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameViewPlayer } from '@war-chest/game-engine';
import { UserAvatar, UserProfileLink } from '#/entities/user';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './PlayerPanel.module.scss';

interface Props {
  isCurrent?: boolean;
  label: string;
  player: GameViewPlayer | undefined;
  profile: LobbyGamePlayer | undefined;
}

export function PlayerPanel(props: Props) {
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
          {profile === undefined ? (
            player === undefined ? (
              t('empty')
            ) : (
              t('playerFallback', { playerId: player.id.slice(0, 8) })
            )
          ) : (
            <UserProfileLink user={profile} />
          )}
        </strong>
        <small>{getPresenceLabel()}</small>
      </div>
    </article>
  );

  function getPresenceLabel(): string {
    if (player === undefined) {
      return t('noPlayer');
    }

    if (player.presence === 'connected') {
      return player.team === 'white' ? t('whiteTeam') : t('blackTeam');
    }

    return player.presence === 'disconnected' ? t('disconnected') : t('left');
  }
}
