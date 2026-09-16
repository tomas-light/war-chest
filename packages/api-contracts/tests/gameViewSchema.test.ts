import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { describe, expect, test } from 'vitest';
import { gameViewSchema } from '../src/schemas.js';

describe('gameViewSchema', () => {
  test('normalizes a waiting snapshot created before battlefield support', () => {
    const result = gameViewSchema.safeParse({
      cardSelection: null,
      creatorId: 'creator',
      currentPlayerId: null,
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      firstPlayerId: null,
      initiativePlayerId: null,
      lastEventSequence: 1,
      moveCount: 0,
      players: [],
      privateMoves: [],
      rulesVersion: 2,
      settings: {
        cardSelectionMode: 'random',
        expansions: [],
        format: 'duel',
      },
      status: 'waiting',
      teams: { black: [], white: [] },
      winnerTeam: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.battlefield).toBeNull();
    }
  });
});
