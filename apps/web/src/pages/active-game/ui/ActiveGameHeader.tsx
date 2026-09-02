import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type { GameView } from '@war-chest/game-engine';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './ActiveGameHeader.module.scss';

interface Props {
  gameId: string;
  onBack(this: void): void;
  playerProfiles: readonly LobbyGamePlayer[];
  userId: string;
  view: GameView;
}

export function ActiveGameHeader(props: Props) {
  const { gameId, onBack, playerProfiles, userId, view } = props;
  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGameHeader',
  });
  const currentPlayer = view.players.find((player) => player.id === userId);
  const isSpectator = currentPlayer === undefined;

  return (
    <header className={classes.header}>
      <div>
        <p className={classes.eyebrow}>
          {isSpectator ? t('spectator') : t('table')}
        </p>
        <h1>{getGameTitle()}</h1>
        <p className={classes.gameId}>{t('gameLabel', { gameId })}</p>
      </div>
      <Button onClick={onBack}>{t('backToLobby')}</Button>
    </header>
  );

  function getGameTitle(): string {
    if (view.status !== 'finished') {
      return t('gameTitle');
    }

    const winnerPlayer = view.players.find(
      (player) => player.team === view.winnerTeam
    );

    if (isSpectator && winnerPlayer !== undefined) {
      const winnerProfile = playerProfiles.find(
        (profile) => profile.id === winnerPlayer.id
      );

      return t('spectatorWinnerTitle', {
        winner:
          winnerProfile?.displayName ??
          t('winnerFallback', { playerId: winnerPlayer.id.slice(0, 8) }),
      });
    }

    if (currentPlayer?.defeatReason === 'surrender') {
      return t('surrenderedTitle');
    }

    const opponent = view.players.find((player) => player.id !== userId);

    if (!isSpectator && opponent?.defeatReason === 'surrender') {
      return t('opponentSurrenderedTitle');
    }

    return t('finishedTitle');
  }
}
