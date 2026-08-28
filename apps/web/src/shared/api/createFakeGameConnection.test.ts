import type { GameResponse } from '@war-chest/api-contracts';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createFakeGameConnection } from './createFakeGameConnection';
import { publishFakeLobbyUpdate } from './fakeLobbyUpdates';
import type { GameConnection } from './gameConnection';

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const GAME_RESPONSE: GameResponse = {
  gameId: GAME_ID,
  view: {
    creatorId: '10000000-0000-4000-8000-000000000001',
    currentPlayerId: null,
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    lastEventSequence: 1,
    moveCount: 0,
    players: [],
    privateMoves: [],
    rulesVersion: 1,
    status: 'waiting',
    teams: { black: [], white: [] },
    winnerTeam: null,
  },
};
const { getGame } = vi.hoisted(() => ({ getGame: vi.fn() }));

vi.mock('./createFakeGameApi', () => ({
  createFakeGameApi: () => ({ getGame }),
}));

describe('fake game connection', () => {
  let connection: GameConnection | undefined;

  afterEach(() => {
    connection?.disconnect();
    vi.clearAllMocks();
  });

  test('refreshes a joined game after another tab changes it', async () => {
    getGame.mockResolvedValue(GAME_RESPONSE);
    const onSnapshot = vi.fn();
    connection = createFakeGameConnection(
      {
        onError: vi.fn(),
        onEvents: vi.fn(),
        onSnapshot,
      },
      GAME_RESPONSE.view.creatorId
    );
    connection.connect();
    connection.join(GAME_ID);

    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(1));
    publishFakeLobbyUpdate({ gameId: GAME_ID });

    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalledTimes(2));
  });
});
