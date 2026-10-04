import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GameViewEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from '@war-chest/game-engine';
import { expect, test } from 'vitest';
import { restoreHistoricalView } from './restoreHistoricalView';

test('rejects missing events instead of displaying an incomplete historical state', () => {
  const events: GameViewEventData[] = [
    {
      payload: {
        creatorId: 'creator-1',
        featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
        rulesVersion: GAME_RULES_VERSION,
        settings: {
          cardSelectionMode: 'random',
          expansions: [],
          format: 'duel',
        },
      },
      sequence: 1,
      type: 'GameCreated',
      version: GAME_EVENT_VERSION,
    },
    {
      payload: { playerId: 'player-1', seat: 1, team: 'white' },
      sequence: 3,
      type: 'PlayerJoined',
      version: GAME_EVENT_VERSION,
    },
  ];

  expect(() => restoreHistoricalView(events, 3)).toThrow('sequence gap');
});

test('a request beyond the loaded event tail cannot masquerade as the requested step', () => {
  const events: GameViewEventData[] = [
    {
      payload: {
        creatorId: 'creator-1',
        featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
        rulesVersion: GAME_RULES_VERSION,
        settings: {
          cardSelectionMode: 'random',
          expansions: [],
          format: 'duel',
        },
      },
      sequence: 1,
      type: 'GameCreated',
      version: GAME_EVENT_VERSION,
    },
  ];

  expect(() => restoreHistoricalView(events, 2)).toThrow('sequence gap');
});
