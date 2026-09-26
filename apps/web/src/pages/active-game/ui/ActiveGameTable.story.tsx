import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  GameTurnHistoryItem,
  LobbyGamePlayer,
} from '@war-chest/api-contracts';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GameCoin,
  type GameFormat,
  type GamePlayer,
  type GameState,
  type GameTeam,
  type UnitId,
  createInitialBattlefield,
  createViewFor,
  GAME_RULES_VERSION,
} from '@war-chest/game-engine';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { type GameWheelAction, GameActions } from '#/features/game-actions';
import { type HandCoinClickInput, ActiveGameTable } from '#/widgets/game-table';
import { TurnQueue } from '#/widgets/turn-queue';
import { getCoinWheelActions } from './getCoinWheelActions';
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
const QUERY_CLIENT = new QueryClient();
const HISTORY_QUERY_CLIENT = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity } },
});
const LAST_COIN_QUERY_CLIENT = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity } },
});
const GAME_ID = '00000000-0000-4000-8000-000000000001';
const HISTORY_ITEMS: readonly GameTurnHistoryItem[] = Array.from(
  { length: 100 },
  (_, index) => ({
    action: 'pass',
    playerId: PLAYER_IDS[index % 2] ?? 'player-one',
    sequence: index + 1,
  })
);
const FOUR_SECTOR_ACTIONS: readonly GameWheelAction[] = [
  { enabled: false, id: 'deploy' },
  { enabled: false, id: 'reinforce' },
  { enabled: true, id: 'pass' },
  { enabled: false, id: 'initiative' },
];
const FIVE_SECTOR_ACTIONS: readonly GameWheelAction[] = [
  { enabled: false, id: 'deploy' },
  { enabled: false, id: 'reinforce' },
  { enabled: false, id: 'maneuver' },
  { enabled: true, id: 'pass' },
  { enabled: false, id: 'initiative' },
];

HISTORY_QUERY_CLIENT.setQueryData(['game-turn-history', GAME_ID, 2], {
  pageParams: [undefined],
  pages: [{ items: HISTORY_ITEMS, nextCursor: null }],
});
LAST_COIN_QUERY_CLIENT.setQueryData(['game-turn-history', GAME_ID, 2], {
  pageParams: [undefined],
  pages: [{ items: [], nextCursor: null }],
});

export function DuelWhitePlayer() {
  return <TableStory format="duel" userId="player-one" />;
}

export function DuelWheelFourSectors() {
  return (
    <TableStory
      format="duel"
      userId="player-one"
      wheelActions={FOUR_SECTOR_ACTIONS}
    />
  );
}

export function DuelWheelFiveSectors() {
  return (
    <TableStory
      format="duel"
      userId="player-one"
      wheelActions={FIVE_SECTOR_ACTIONS}
    />
  );
}

export function DuelRoyalWheel() {
  return <TableStory format="duel" royalFirst userId="player-one" />;
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

export function DuelQueueHistory() {
  const players = createPlayers('duel');
  const view = createViewFor(createState('duel', players), {
    playerId: 'player-one',
    role: 'player',
  });

  return (
    <QueryClientProvider client={HISTORY_QUERY_CLIENT}>
      <main className={classes.page}>
        <TurnQueue
          gameId={GAME_ID}
          playerProfiles={createProfiles(players)}
          view={view}
        />
      </main>
    </QueryClientProvider>
  );
}

export function DuelQueueTurnAdvance() {
  return <TurnAdvanceStory initialHistoryCount={20} />;
}

export function DuelQueueShortTurnAdvance() {
  return <TurnAdvanceStory initialHistoryCount={4} />;
}

export function DuelQueueDelayedHistory() {
  return <TurnAdvanceStory deferHistory initialHistoryCount={4} />;
}

export function DuelQueueRollingHistory() {
  return <TurnAdvanceStory initialHistoryCount={2} rollingHistory />;
}

interface TurnAdvanceStoryProps {
  deferHistory?: boolean;
  initialHistoryCount: number;
  rollingHistory?: boolean;
}

function TurnAdvanceStory(props: TurnAdvanceStoryProps) {
  const {
    deferHistory = false,
    initialHistoryCount,
    rollingHistory = false,
  } = props;

  const initialHistoryItems = HISTORY_ITEMS.slice(0, initialHistoryCount);
  const [queryClient] = useState(() =>
    createAdvancingQueryClient(initialHistoryItems)
  );
  const [advanceCount, setAdvanceCount] = useState(0);
  const players = createPlayers('duel');
  const state = createState('duel', players);
  state.lastEventSequence = initialHistoryCount + advanceCount;
  state.moveCount += advanceCount;

  if (advanceCount % 2 === 1) {
    state.currentPlayerId = 'player-two';
  }

  const view = createViewFor(state, {
    playerId: 'player-one',
    role: 'player',
  });

  return (
    <QueryClientProvider client={queryClient}>
      <main className={classes.page}>
        <button onClick={advanceTurn} type="button">
          Передать ход
        </button>
        {deferHistory ? (
          <button
            disabled={advanceCount === 0}
            onClick={() => synchronizeHistory(advanceCount)}
            type="button"
          >
            Загрузить историю
          </button>
        ) : null}
        <TurnQueue
          gameId={GAME_ID}
          playerProfiles={createProfiles(players)}
          view={view}
        />
      </main>
    </QueryClientProvider>
  );

  function advanceTurn(): void {
    const nextAdvanceCount = advanceCount + 1;

    if (!deferHistory) {
      synchronizeHistory(nextAdvanceCount);
    }

    setAdvanceCount(nextAdvanceCount);
  }

  function synchronizeHistory(completedTurns: number): void {
    const completedHistoryItems: GameTurnHistoryItem[] = Array.from(
      { length: completedTurns },
      (_, index) => ({
        action: 'pass',
        playerId: PLAYER_IDS[index % 2] ?? 'player-one',
        sequence: initialHistoryCount + index + 1,
      })
    );
    const allHistoryItems = [...initialHistoryItems, ...completedHistoryItems];
    const visibleHistoryItems = rollingHistory
      ? allHistoryItems.slice(-2)
      : allHistoryItems;

    queryClient.setQueryData(['game-turn-history', GAME_ID, 2], {
      pageParams: [undefined],
      pages: [
        {
          items: visibleHistoryItems,
          nextCursor: null,
        },
      ],
    });
  }
}

export function DuelQueueLastCoin() {
  const players = createPlayers('duel');
  const state = createState('duel', players);
  const currentResources = state.battlefield?.playerResources.find(
    (resources) => resources.playerId === 'player-one'
  );

  if (currentResources !== undefined) {
    currentResources.hand = currentResources.hand.slice(0, 1);
  }

  const view = createViewFor(state, {
    playerId: 'player-one',
    role: 'player',
  });

  return (
    <QueryClientProvider client={LAST_COIN_QUERY_CLIENT}>
      <main className={classes.page}>
        <TurnQueue
          gameId={GAME_ID}
          playerProfiles={createProfiles(players)}
          view={view}
        />
      </main>
    </QueryClientProvider>
  );
}

export function DuelQueueRoundBoundary() {
  const players = createPlayers('duel');
  const state = createState('duel', players);
  const firstPlayerResources = state.battlefield?.playerResources.find(
    (resources) => resources.playerId === 'player-one'
  );
  const secondPlayerResources = state.battlefield?.playerResources.find(
    (resources) => resources.playerId === 'player-two'
  );

  if (firstPlayerResources !== undefined) {
    firstPlayerResources.discard = firstPlayerResources.hand.map((coin) => ({
      coin,
      faceUp: false,
    }));
    firstPlayerResources.hand = [];
  }

  if (secondPlayerResources !== undefined) {
    secondPlayerResources.discard = secondPlayerResources.hand
      .slice(0, -1)
      .map((coin) => ({ coin, faceUp: false }));
    secondPlayerResources.hand = secondPlayerResources.hand.slice(-1);
  }

  state.currentPlayerId = 'player-two';

  const view = createViewFor(state, {
    playerId: 'player-two',
    role: 'player',
  });

  return (
    <QueryClientProvider client={LAST_COIN_QUERY_CLIENT}>
      <main className={classes.page}>
        <TurnQueue
          gameId={GAME_ID}
          playerProfiles={createProfiles(players)}
          view={view}
        />
      </main>
    </QueryClientProvider>
  );
}

export function DuelQueueConsecutiveTurns() {
  const players = createPlayers('duel');
  const state = createState('duel', players);

  for (const resources of state.battlefield?.playerResources ?? []) {
    const remainingCount = resources.playerId === 'player-one' ? 1 : 2;

    resources.discard = resources.hand
      .slice(0, -remainingCount)
      .map((coin) => ({ coin, faceUp: false }));
    resources.hand = resources.hand.slice(-remainingCount);
  }

  const view = createViewFor(state, {
    playerId: 'player-one',
    role: 'player',
  });

  return (
    <QueryClientProvider client={LAST_COIN_QUERY_CLIENT}>
      <main className={classes.page}>
        <TurnQueue
          gameId={GAME_ID}
          playerProfiles={createProfiles(players)}
          view={view}
        />
      </main>
    </QueryClientProvider>
  );
}

interface TableStoryProps {
  format: GameFormat;
  royalFirst?: boolean;
  userId: string;
  wheelActions?: readonly GameWheelAction[];
}

function TableStory(props: TableStoryProps) {
  const { format, royalFirst = false, userId, wheelActions } = props;
  const players = createPlayers(format);
  const state = createState(format, players);

  if (royalFirst) {
    const resources = state.battlefield?.playerResources.find(
      (item) => item.playerId === userId
    );

    if (resources !== undefined) {
      resources.hand[0] = { kind: 'royal' };
    }
  }

  const viewer = players.some((player) => player.id === userId)
    ? ({ playerId: userId, role: 'player' } as const)
    : ({ role: 'spectator' } as const);
  const view = createViewFor(state, viewer);
  const playerProfiles = createProfiles(players);
  const [selectedCoin, setSelectedCoin] = useState<SelectedCoin | null>(null);

  return (
    <QueryClientProvider client={QUERY_CLIENT}>
      <MemoryRouter>
        <main className={classes.page}>
          <ActiveGameTable
            onHandCoinClick={handleHandCoinClick}
            playerProfiles={playerProfiles}
            selectedCoinIndex={selectedCoin?.index ?? null}
            userId={userId}
            view={view}
          />
        </main>
        {selectedCoin === null ? null : (
          <GameActions
            actions={
              wheelActions ??
              getCoinWheelActions(
                selectedCoin.coin,
                view.status === 'active' &&
                  view.settings.format === 'duel' &&
                  view.currentPlayerId === userId
              )
            }
            anchorElement={selectedCoin.anchorElement}
            coin={selectedCoin.coin}
            coinIndex={selectedCoin.index}
            gameId={GAME_ID}
            onClose={closeGameActions}
            onPassed={() => undefined}
            view={view}
          />
        )}
      </MemoryRouter>
    </QueryClientProvider>
  );

  function handleHandCoinClick(input: HandCoinClickInput): void {
    if (selectedCoin?.index === input.index) {
      closeGameActions();
    } else {
      setSelectedCoin(input);
    }
  }

  function closeGameActions(): void {
    setSelectedCoin(null);
  }
}

interface SelectedCoin {
  anchorElement: HTMLButtonElement;
  coin: GameCoin;
  index: number;
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
    rulesVersion: GAME_RULES_VERSION,
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

function createAdvancingQueryClient(
  historyItems: readonly GameTurnHistoryItem[]
): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });

  queryClient.setQueryData(['game-turn-history', GAME_ID, 2], {
    pageParams: [undefined],
    pages: [{ items: historyItems, nextCursor: null }],
  });

  return queryClient;
}
