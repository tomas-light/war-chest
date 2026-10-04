import { describe, expect, test } from 'vitest';
import { saveTurnDraftRequestSchema } from '../src/schemas.js';

describe('Footman tactic draft contract', () => {
  test.each([1, 2])('accepts a saved prefix of %i movements', (count) => {
    const result = saveTurnDraftRequestSchema.safeParse({
      action: {
        maneuvers: [
          { battlefieldUnitId: 'first', cellId: 'C1', type: 'move' },
          { battlefieldUnitId: 'second', cellId: 'B1', type: 'move' },
        ].slice(0, count),
        type: 'tactic',
        unitId: 'footman',
      },
      coinIndex: 0,
      expectedVersion: 10,
    });

    expect(result.success).toBe(true);
  });

  test.each([0, 3])('rejects a draft of %i movements', (count) => {
    const result = saveTurnDraftRequestSchema.safeParse({
      action: {
        maneuvers: Array.from({ length: count }, (_, index) => ({
          battlefieldUnitId: `unit-${index}`,
          cellId: 'C1',
          type: 'move',
        })),
        type: 'tactic',
        unitId: 'footman',
      },
      coinIndex: 0,
      expectedVersion: 10,
    });

    expect(result.success).toBe(false);
  });

  test('rejects a second maneuver by the same footman', () => {
    const result = saveTurnDraftRequestSchema.safeParse({
      action: {
        maneuvers: [
          { battlefieldUnitId: 'first', cellId: 'C1', type: 'move' },
          { battlefieldUnitId: 'first', cellId: 'D1', type: 'move' },
        ],
        type: 'tactic',
        unitId: 'footman',
      },
      coinIndex: 0,
      expectedVersion: 10,
    });

    expect(result.success).toBe(false);
  });

  test.each(['archer', 'mercenary'])(
    'rejects an unsupported tactic for %s',
    (unitId) => {
      const result = saveTurnDraftRequestSchema.safeParse({
        action: {
          maneuvers: [
            { battlefieldUnitId: 'first', cellId: 'C1', type: 'move' },
          ],
          type: 'tactic',
          unitId,
        },
        coinIndex: 0,
        expectedVersion: 10,
      });

      expect(result.success).toBe(false);
    }
  );

  test('rejects an unsupported maneuver inside the tactic', () => {
    const result = saveTurnDraftRequestSchema.safeParse({
      action: {
        maneuvers: [
          { battlefieldUnitId: 'first', cellId: 'C1', type: 'attack' },
        ],
        type: 'tactic',
        unitId: 'footman',
      },
      coinIndex: 0,
      expectedVersion: 10,
    });

    expect(result.success).toBe(false);
  });
});
