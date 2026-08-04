import { describe, expect, test } from 'vitest';
import {
  gameEventsMessageSchema,
  sessionResponseSchema,
} from '../src/index.js';

describe('session response contract', () => {
  test('accepts a serialized authenticated session', () => {
    const result = sessionResponseSchema.safeParse({
      expiresAt: '2026-09-03T10:00:00.000Z',
      user: {
        avatarVersion: null,
        displayName: 'Ada',
        id: 'user-1',
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('game events contract', () => {
  test('rejects an event with an unsupported version', () => {
    const result = gameEventsMessageSchema.safeParse({
      events: [
        {
          payload: {
            featureFlags: {},
            rulesVersion: 1,
          },
          sequence: 1,
          type: 'GameCreated',
          version: 2,
        },
      ],
      gameId: 'game-1',
    });

    expect(result.success).toBe(false);
  });
});
