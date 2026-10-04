import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GameCreatedViewEventData,
  type GameViewEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from '@war-chest/game-engine';
import { describe, expect, test } from 'vitest';
import { getTurnDetails } from './getTurnDetails';

const CREATED_EVENT: GameCreatedViewEventData = {
  payload: {
    creatorId: 'player-one',
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    rulesVersion: GAME_RULES_VERSION,
    settings: { cardSelectionMode: 'random', expansions: [], format: 'duel' },
  },
  sequence: 1,
  type: 'GameCreated',
  version: GAME_EVENT_VERSION,
};

describe('completed turn details', () => {
  test('movement uses the source cell and round before the confirmed action', () => {
    const events: GameViewEventData[] = [
      CREATED_EVENT,
      {
        payload: {
          controlPoints: [],
          playerResources: [],
          round: 1,
          units: [
            {
              id: 'moving-unit',
              bolstered: 0,
              cellId: 'B1',
              ownerId: 'player-one',
              unitId: 'cavalry',
            },
          ],
        },
        sequence: 2,
        type: 'BattlefieldPrepared',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: {
          action: {
            battlefieldUnitId: 'moving-unit',
            cellId: 'C2',
            type: 'move',
          },
          battlefield: {
            controlPoints: [],
            playerResources: [],
            round: 2,
            units: [
              {
                id: 'moving-unit',
                bolstered: 0,
                cellId: 'C2',
                ownerId: 'player-one',
                unitId: 'cavalry',
              },
            ],
          },
          coin: null,
          moveNumber: 1,
          nextPlayerId: 'player-two',
          playerId: 'player-one',
        },
        sequence: 3,
        type: 'TurnActionPerformed',
        version: GAME_EVENT_VERSION,
      },
    ];

    expect(getTurnDetails(events, 3)).toEqual({
      action: 'move',
      cellId: 'C2',
      fromCellId: 'B1',
      moveNumber: 1,
      round: 1,
      unitId: 'cavalry',
    });
  });

  test('a hidden pass never exposes a unit from public battlefield pieces', () => {
    const events: GameViewEventData[] = [
      CREATED_EVENT,
      {
        payload: {
          battlefield: {
            controlPoints: [],
            playerResources: [],
            round: 1,
            units: [
              {
                id: 'unit',
                bolstered: 0,
                cellId: 'B1',
                ownerId: 'player-one',
                unitId: 'cavalry',
              },
            ],
          },
          coin: null,
          moveNumber: 1,
          nextPlayerId: 'player-two',
          playerId: 'player-one',
        },
        sequence: 2,
        type: 'TurnPassed',
        version: GAME_EVENT_VERSION,
      },
    ];

    expect(getTurnDetails(events, 2)?.unitId).toBeNull();
  });
});
