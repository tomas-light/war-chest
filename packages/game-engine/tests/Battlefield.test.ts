import { describe, expect, test } from 'vitest';
import { getBattlefieldLayout } from '../src/Battlefield.js';

describe('battlefield layouts', () => {
  test('models duel ore as control-point cells', () => {
    const layout = getBattlefieldLayout('duel');

    expect(layout.cells).toHaveLength(37);
    expect(layout.cells.filter((cell) => cell.kind === 'ground')).toHaveLength(
      27
    );
    expect(
      layout.cells.filter((cell) => cell.kind === 'controlPoint')
    ).toHaveLength(10);
  });

  test('models team ore and team zones as cell properties', () => {
    const layout = getBattlefieldLayout('team');

    expect(layout.cells).toHaveLength(47);
    expect(layout.cells.filter((cell) => cell.kind === 'ground')).toHaveLength(
      33
    );
    expect(
      layout.cells.filter((cell) => cell.kind === 'controlPoint')
    ).toHaveLength(14);
    expect(layout.cells.filter((cell) => cell.zone === 'team')).toEqual([
      { cellId: 'A5', kind: 'ground', zone: 'team' },
      { cellId: 'A6', kind: 'controlPoint', zone: 'team' },
      { cellId: 'B6', kind: 'ground', zone: 'team' },
      { cellId: 'B7', kind: 'ground', zone: 'team' },
      { cellId: 'F1', kind: 'ground', zone: 'team' },
      { cellId: 'F2', kind: 'ground', zone: 'team' },
      { cellId: 'G2', kind: 'controlPoint', zone: 'team' },
      { cellId: 'G3', kind: 'ground', zone: 'team' },
    ]);
  });
});
