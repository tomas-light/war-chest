import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameViewPlayer } from '@war-chest/game-engine';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { PlayerPanel } from './PlayerPanel';
import classes from './ActiveGameTable.module.scss';

interface Props {
  playerProfiles: readonly LobbyGamePlayer[];
  players: readonly GameViewPlayer[];
  userId: string;
}

export function ActiveGameTable(props: Props) {
  const { playerProfiles, players, userId } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGameTable',
  });
  const currentPlayer = players.find((player) => player.id === userId);
  const opponent = players.find((player) => player.id !== userId);
  const whitePlayer = players.find((player) => player.team === 'white');
  const blackPlayer = players.find((player) => player.team === 'black');
  const topPlayer = currentPlayer === undefined ? whitePlayer : opponent;
  const bottomPlayer = currentPlayer ?? blackPlayer;
  const isSpectator = currentPlayer === undefined;

  return (
    <section aria-label={t('tableArea')} className={classes.tableArea}>
      <PlayerPanel
        label={isSpectator ? t('playerTop') : t('opponent')}
        player={topPlayer}
        profile={findProfile(topPlayer)}
      />

      <div className={classes.boardPlaceholder}>
        <span>{t('boardLabel')}</span>
        <p>{t('boardDescription')}</p>
      </div>

      <PlayerPanel
        isCurrent={!isSpectator}
        label={isSpectator ? t('playerBottom') : t('you')}
        player={bottomPlayer}
        profile={findProfile(bottomPlayer)}
      />
    </section>
  );

  function findProfile(
    player: GameViewPlayer | undefined
  ): LobbyGamePlayer | undefined {
    return playerProfiles.find((profile) => profile.id === player?.id);
  }
}
