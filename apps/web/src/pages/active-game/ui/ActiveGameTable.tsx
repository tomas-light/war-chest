import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import type {
  GameTeam,
  GameView,
  GameViewPlayer,
} from '@war-chest/game-engine';
import { type ReactNode, useState } from 'react';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { BattlefieldBoard } from './BattlefieldBoard';
import { GamePlayerSwitchButton } from './GamePlayerSwitchButton';
import { PlayerPanel } from './PlayerPanel';
import classes from './ActiveGameTable.module.scss';

interface Props {
  playerProfiles: readonly LobbyGamePlayer[];
  userId: string;
  view: GameView;
}

interface TeamPanelsProps {
  currentPlayer: GameViewPlayer | undefined;
  isSpectator: boolean;
  players: readonly GameViewPlayer[];
  position: 'bottom' | 'top';
}

export function ActiveGameTable(props: Props) {
  const { playerProfiles, userId, view } = props;

  const { t } = useTranslation('pages/active-game', {
    keyPrefix: 'ActiveGameTable',
  });

  const [topPlayerIndex, setTopPlayerIndex] = useState(0);
  const [bottomPlayerIndex, setBottomPlayerIndex] = useState(0);

  const currentPlayer = view.players.find((player) => player.id === userId);
  const isSpectator = currentPlayer === undefined;

  const perspective = getPerspective();
  const topTeam = getTopTeam();
  const bottomTeam = topTeam === 'white' ? 'black' : 'white';
  const topPlayers = getTeamPlayers(topTeam);
  const bottomPlayers = getTeamPlayers(bottomTeam);

  const initiativeOwner = view.players.find(
    (player) => player.id === view.initiativePlayerId
  );
  const initiativeOwnerName =
    findProfile(initiativeOwner)?.displayName ??
    t('playerFallback', {
      playerId: initiativeOwner?.id.slice(0, 8) ?? '—',
    });

  if (view.battlefield === null) {
    return (
      <section aria-label={t('tableArea')} className={classes.emptyTable}>
        {t('preparing')}
      </section>
    );
  }

  return (
    <section aria-label={t('tableArea')} className={classes.tableArea}>
      {renderTeamPanels({
        currentPlayer,
        isSpectator,
        players: topPlayers,
        position: 'top',
      })}

      <BattlefieldBoard
        battlefield={view.battlefield}
        format={view.settings.format}
        initiativeOwnerName={initiativeOwnerName}
        perspective={perspective}
        players={view.players}
      />

      {renderTeamPanels({
        currentPlayer,
        isSpectator,
        players: bottomPlayers,
        position: 'bottom',
      })}
    </section>
  );

  function renderTeamPanels(panelProps: TeamPanelsProps) {
    const { currentPlayer, isSpectator, players, position } = panelProps;

    const selectedIndex =
      position === 'top' ? topPlayerIndex : bottomPlayerIndex;
    const setSelectedIndex =
      position === 'top' ? setTopPlayerIndex : setBottomPlayerIndex;
    let mobileSwitchControl: ReactNode;

    if (players.length > 1) {
      mobileSwitchControl = (
        <GamePlayerSwitchButton
          aria-label={t('showTeammate')}
          onClick={() => handleSwitch(selectedIndex)}
        />
      );
    }

    return (
      <div className={classes.teamPanels} data-count={players.length}>
        {players.map((player, index) => (
          <div
            className={classes.playerSlot}
            data-mobile-visible={index === selectedIndex}
            key={player.id}
          >
            <PlayerPanel
              hasInitiative={player.id === view.initiativePlayerId}
              isCurrent={player.id === currentPlayer?.id}
              label={getPlayerLabel(player, position, isSpectator)}
              mobileSwitchControl={mobileSwitchControl}
              player={player}
              profile={findProfile(player)}
              resources={view.battlefield?.playerResources.find(
                (resources) => resources.playerId === player.id
              )}
            />
          </div>
        ))}
      </div>
    );

    function handleSwitch(index: number): void {
      if (index === 0) {
        setSelectedIndex(1);
      } else {
        setSelectedIndex(0);
      }
    }
  }

  function getPlayerLabel(
    player: GameViewPlayer,
    position: 'bottom' | 'top',
    spectator: boolean
  ): string {
    if (spectator) {
      return position === 'top' ? t('playerTop') : t('playerBottom');
    }

    if (player.id === userId) {
      return t('you');
    }

    return player.team === currentPlayer?.team ? t('ally') : t('opponent');
  }

  function getPerspective(): GameTeam {
    if (currentPlayer === undefined) {
      return 'black';
    }

    return currentPlayer.team;
  }

  function getTopTeam(): GameTeam {
    if (currentPlayer === undefined) {
      return 'white';
    }

    return currentPlayer.team === 'white' ? 'black' : 'white';
  }

  function getTeamPlayers(team: GameTeam): readonly GameViewPlayer[] {
    return view.players
      .filter((player) => player.team === team)
      .sort((first, second) => first.seat - second.seat);
  }

  function findProfile(
    player: GameViewPlayer | undefined
  ): LobbyGamePlayer | undefined {
    return playerProfiles.find((profile) => profile.id === player?.id);
  }
}
