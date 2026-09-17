import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GamePlayer,
  type GameState,
  createInitialBattlefield,
  createViewFor,
  GAME_RULES_VERSION,
} from '@war-chest/game-engine';
import { MemoryRouter } from 'react-router';
import { ActiveGameSidebar } from './ActiveGameSidebar';
import classes from './ActiveGameSidebar.story.module.scss';

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const USER_ID = 'player-one';
const QUERY_CLIENT = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const PLAYERS: readonly GamePlayer[] = [
  createPlayer('player-one', 'white', [
    'archer',
    'cavalry',
    'pikeman',
    'scout',
  ]),
  createPlayer('player-two', 'black', [
    'berserker',
    'crossbowman',
    'knight',
    'lancer',
  ]),
];

export function CurrentPlayerPass() {
  const battlefield = createInitialBattlefield({
    format: 'duel',
    players: PLAYERS,
  });
  const currentResources = battlefield.playerResources.find(
    (resources) => resources.playerId === USER_ID
  );

  if (currentResources === undefined) {
    throw new Error('Sidebar story requires current player resources.');
  }

  currentResources.hand = [
    { kind: 'royal' },
    { kind: 'unit', unitId: 'archer' },
    { kind: 'unit', unitId: 'cavalry' },
  ];

  const state: GameState = {
    battlefield,
    cardSelection: null,
    creatorId: USER_ID,
    currentPlayerId: USER_ID,
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    firstPlayerId: USER_ID,
    initiativePlayerId: USER_ID,
    lastEventSequence: 6,
    moveCount: 0,
    players: PLAYERS,
    rulesVersion: GAME_RULES_VERSION,
    settings: { cardSelectionMode: 'random', expansions: [], format: 'duel' },
    status: 'active',
    teams: { black: ['player-two'], white: [USER_ID] },
    winnerTeam: null,
  };
  const view = createViewFor(state, { playerId: USER_ID, role: 'player' });

  return (
    <QueryClientProvider client={QUERY_CLIENT}>
      <MemoryRouter>
        <main className={classes.page}>
          <ActiveGameSidebar
            gameId={GAME_ID}
            onViewChanged={() => undefined}
            userId={USER_ID}
            view={view}
          />
        </main>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function createPlayer(
  id: string,
  team: GamePlayer['team'],
  cardIds: GamePlayer['cardIds']
): GamePlayer {
  return {
    cardIds,
    defeatReason: null,
    id,
    moveCount: 0,
    presence: 'connected',
    privateMoves: [],
    reconnectDeadline: null,
    seat: 1,
    team,
  };
}
