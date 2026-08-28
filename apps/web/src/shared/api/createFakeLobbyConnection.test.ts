import { afterEach, describe, expect, test, vi } from 'vitest';
import { createFakeLobbyConnection } from './createFakeLobbyConnection';
import { publishFakeLobbyUpdate } from './fakeLobbyUpdates';
import type { LobbyConnection } from './lobbyConnection';

const GAME_ID = '20000000-0000-4000-8000-000000000001';

describe('fake lobby connection', () => {
  let connection: LobbyConnection | undefined;

  afterEach(() => {
    connection?.disconnect();
  });

  test('delivers an updated game to a connected lobby', async () => {
    const onUpdated = vi.fn();
    connection = createFakeLobbyConnection({
      onSubscribed: vi.fn(),
      onUpdated,
    });
    connection.connect();

    publishFakeLobbyUpdate({ gameId: GAME_ID });

    await vi.waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith({ gameId: GAME_ID });
    });
  });
});
