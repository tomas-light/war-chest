import type { LobbyGamePlayer } from '@war-chest/api-contracts';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GameFormat,
  type GamePlayer,
  type GameState,
  type GameTeam,
  type UnitId,
  createInitialBattlefield,
  createViewFor,
} from '@war-chest/game-engine';
import { MemoryRouter } from 'react-router';
import { ActiveGameTable } from './ActiveGameTable';
import classes from './ActiveGameTable.story.module.scss';

const DUEL_UNITS: readonly UnitId[][] = [
  ['archer', 'cavalry', 'pikeman', 'scout'],
  ['berserker', 'crossbowman', 'knight', 'lancer'],
];
const TEAM_UNITS: readonly UnitId[][] = [
  ['archer', 'cavalry', 'pikeman'],
  ['berserker', 'crossbowman', 'knight'],
  ['ensign', 'footman', 'marshal'],
  ['lancer', 'scout', 'swordsman'],
];
const PLAYER_IDS = ['player-one', 'player-two', 'player-three', 'player-four'];

export function DuelWhitePlayer() {
  return <TableStory format="duel" userId="player-one" />;
}

export function DuelBlackPlayer() {
  return <TableStory format="duel" userId="player-two" />;
}

export function DuelSpectator() {
  return <TableStory format="duel" userId="spectator" />;
}

export function TeamWhitePlayer() {
  return <TableStory format="team" userId="player-one" />;
}

interface TableStoryProps {
  format: GameFormat;
  userId: string;
}

function TableStory(props: TableStoryProps) {
  const { format, userId } = props;
  const players = createPlayers(format);
  const state = createState(format, players);
  const viewer = players.some((player) => player.id === userId)
    ? ({ playerId: userId, role: 'player' } as const)
    : ({ role: 'spectator' } as const);
  const view = createViewFor(state, viewer);
  const playerProfiles = createProfiles(players);

  return (
    <MemoryRouter>
      <main className={classes.page}>
        <ActiveGameTable
          playerProfiles={playerProfiles}
          userId={userId}
          view={view}
        />
      </main>
    </MemoryRouter>
  );
}

function createPlayers(format: GameFormat): readonly GamePlayer[] {
  const unitGroups = format === 'duel' ? DUEL_UNITS : TEAM_UNITS;

  return unitGroups.map((cardIds, index) => {
    const team: GameTeam = index % 2 === 0 ? 'white' : 'black';
    const id = PLAYER_IDS[index];

    if (id === undefined) {
      throw new Error(`Missing story player id for index ${index}.`);
    }

    return {
      cardIds,
      defeatReason: null,
      id,
      moveCount: 0,
      presence: 'connected',
      privateMoves: [],
      reconnectDeadline: null,
      seat: Math.floor(index / 2) + 1,
      team,
    };
  });
}

function createState(
  format: GameFormat,
  players: readonly GamePlayer[]
): GameState {
  return {
    battlefield: createInitialBattlefield({ format, players }),
    cardSelection: null,
    creatorId: 'player-one',
    currentPlayerId: 'player-one',
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    firstPlayerId: 'player-one',
    initiativePlayerId: 'player-one',
    lastEventSequence: 6,
    moveCount: 0,
    players,
    rulesVersion: 2,
    settings: { cardSelectionMode: 'random', expansions: [], format },
    status: 'active',
    teams: {
      black: players
        .filter((player) => player.team === 'black')
        .map((player) => player.id),
      white: players
        .filter((player) => player.team === 'white')
        .map((player) => player.id),
    },
    winnerTeam: null,
  };
}

function createProfiles(
  players: readonly GamePlayer[]
): readonly LobbyGamePlayer[] {
  return players.map((player, index) => ({
    avatarVersion: `preset:${index + 1}`,
    displayName: ['Марина', 'Алексей', 'Ирина', 'Дмитрий'][index] ?? player.id,
    id: player.id,
    seat: player.seat,
    team: player.team,
  }));
}
