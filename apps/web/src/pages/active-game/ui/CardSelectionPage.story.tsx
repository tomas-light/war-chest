import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { type GameView, type UnitId } from '@war-chest/game-engine';
import { CardSelectionPage } from './CardSelectionPage';
import classes from './ActiveGamePage.module.scss';

const QUERY_CLIENT = new QueryClient();
const PLAYER_IDS = [
  'player-one',
  'player-two',
  'player-three',
  'player-four',
] as const;
const PLAYER_NAMES = ['ux user', 'fe user', 'Воин-жрец', 'Berserker'];
const DRAFT_UNITS: readonly UnitId[] = [
  'archer',
  'cavalry',
  'berserker',
  'crossbowman',
  'footman',
  'knight',
  'lancer',
  'lightCavalry',
  'ensign',
  'marshal',
  'mercenary',
  'pikeman',
];
const BAN_UNITS: readonly UnitId[] = [
  'royalGuard',
  'scout',
  'swordsman',
  'warriorPriest',
];
const DUEL_ORDER = [0, 1, 1, 0, 0, 1, 1, 0];
const TEAM_ORDER = [0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3];

export function StartDuelDraft() {
  return <SelectionStory />;
}

export function WaitingDuelDraft() {
  return <SelectionStory userId={PLAYER_IDS[1]} />;
}

export function CompleteDuelDraft() {
  return <SelectionStory connected={false} picks={8} />;
}

export function LastManualDuelPick() {
  return <SelectionStory picks={6} userId={PLAYER_IDS[1]} />;
}

export function LastManualTeamPick() {
  return <SelectionStory picks={10} team userId={PLAYER_IDS[2]} />;
}

export function DuelBan() {
  return <SelectionStory bans={0} />;
}

export function StartTeamDraft() {
  return <SelectionStory team />;
}

export function ReverseTeamDraft() {
  return <SelectionStory picks={5} team />;
}

export function TeamBan() {
  return <SelectionStory bans={0} team />;
}

export function ReverseTeamElimination() {
  return <SelectionStory bans={4} picks={5} team />;
}

export function CompleteTeamElimination() {
  return <SelectionStory bans={4} connected={false} picks={12} team />;
}

export function CompleteTeamDraft() {
  return <SelectionStory connected={false} picks={12} team />;
}

export function DisconnectedTeamDraft() {
  return <SelectionStory connected={false} team />;
}

interface Props {
  bans?: number;
  connected?: boolean;
  picks?: number;
  team?: boolean;
  userId?: string;
}

function SelectionStory(props: Props) {
  const {
    bans,
    connected = true,
    picks = 0,
    team = false,
    userId = PLAYER_IDS[0],
  } = props;

  const playerOrder = team ? PLAYER_IDS : PLAYER_IDS.slice(0, 2);
  const totalCards = team ? 12 : 8;
  const pickOrder = team ? TEAM_ORDER : DUEL_ORDER;
  const pool = DRAFT_UNITS.slice(0, totalCards);

  const bannedUnits =
    bans === undefined ? [] : BAN_UNITS.slice(0, playerOrder.length);
  const choices = [
    ...bannedUnits.slice(0, bans).map((unitId, index) => ({
      action: 'ban' as const,
      playerId: playerOrder[index] ?? PLAYER_IDS[0],
      unitId,
    })),
    ...pool.slice(0, picks).map((unitId, index) => ({
      action: 'pick' as const,
      playerId: PLAYER_IDS[pickOrder[index] ?? 0] ?? PLAYER_IDS[0],
      unitId,
    })),
  ];

  const playerProfiles = playerOrder.map((id, index) => ({
    avatarVersion: null,
    displayName: PLAYER_NAMES[index] ?? id,
    id,
    seat: Math.floor(index / 2) + 1,
    team: index % 2 === 0 ? ('white' as const) : ('black' as const),
  }));

  const view: GameView = {
    cardSelection: {
      choices,
      phase:
        bans !== undefined && bans < playerOrder.length
          ? 'banning'
          : picks === totalCards
            ? 'complete'
            : 'picking',
      playerOrder,
      pool: [...pool, ...bannedUnits],
    },
    creatorId: PLAYER_IDS[0],
    currentPlayerId: null,
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    firstPlayerId: PLAYER_IDS[0],
    initiativePlayerId: PLAYER_IDS[0],
    lastEventSequence: choices.length + 6,
    moveCount: 0,
    players: playerProfiles.map((player) => ({
      cardIds: choices
        .filter(
          (choice) => choice.playerId === player.id && choice.action === 'pick'
        )
        .map((choice) => choice.unitId),
      defeatReason: null,
      id: player.id,
      moveCount: 0,
      presence: 'connected',
      reconnectDeadline: null,
      seat: player.seat,
      team: player.team,
    })),
    privateMoves: [],
    rulesVersion: 2,
    settings: {
      cardSelectionMode: bans === undefined ? 'draft' : 'eliminationDraft',
      expansions: [],
      format: team ? 'team' : 'duel',
    },
    status: 'cardSelection',
    teams: {
      black: playerProfiles
        .filter((player) => player.team === 'black')
        .map((player) => player.id),
      white: playerProfiles
        .filter((player) => player.team === 'white')
        .map((player) => player.id),
    },
    winnerTeam: null,
  };

  return (
    <QueryClientProvider client={QUERY_CLIENT}>
      <main className={classes.selectionPage} style={{ margin: '0 auto' }}>
        <CardSelectionPage
          gameId="00000000-0000-4000-8000-000000000001"
          isConnectionReady={connected}
          onConfirmed={ignoreConfirmation}
          playerProfiles={playerProfiles}
          userId={userId}
          view={view}
        />
      </main>
    </QueryClientProvider>
  );
}

function ignoreConfirmation(): void {}
