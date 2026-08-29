import type { GameResponse } from '@war-chest/api-contracts';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FakeBackendClient } from './createFakeBackendClient';
import { createFakeGameConnection } from './createFakeGameConnection';
import type { GameConnection } from './gameConnection';
import { getFakeBackendClient } from './getFakeBackendClient';

vi.mock('./getFakeBackendClient', { spy: true });

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const GAME_RESPONSE: GameResponse = {
  gameId: GAME_ID,
  players: [],
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

describe('fake game connection', () => {
  let connection: GameConnection | undefined;
  let joinGameConnection: ReturnType<
    typeof vi.fn<FakeBackendClient['joinGameConnection']>
  >;

  beforeEach(() => {
    joinGameConnection = vi.fn<FakeBackendClient['joinGameConnection']>();
    vi.mocked(getFakeBackendClient).mockReturnValue({
      disconnectGameConnection: vi.fn().mockResolvedValue(undefined),
      joinGameConnection,
      subscribe: vi.fn(() => vi.fn()),
    } as unknown as FakeBackendClient);
  });

  afterEach(() => {
    connection?.disconnect();
    vi.restoreAllMocks();
  });

  test('delivers the initial fake game snapshot', async () => {
    joinGameConnection.mockResolvedValue(GAME_RESPONSE);
    const onSnapshot = vi.fn();
    connection = createFakeGameConnection({
      onError: vi.fn(),
      onEvents: vi.fn(),
      onSnapshot,
    });
    connection.connect();
    connection.join(GAME_ID);

    await vi.waitFor(() => {
      expect(onSnapshot).toHaveBeenCalledWith(GAME_RESPONSE);
    });
  });
});
