import type { GameState } from '@war-chest/game-engine';
import { describe, expect, test, vi } from 'vitest';
import { createActiveGames } from '../src/games/ActiveGames.js';

const WAITING_STATE: GameState = {
  currentPlayerId: null,
  featureFlags: { spectatorMode: true },
  lastEventSequence: 1,
  moveCount: 0,
  players: [],
  rulesVersion: 1,
  status: 'waiting',
  teams: { black: [], white: [] },
  winnerTeam: null,
};

describe('ActiveGames', () => {
  test('stores state without duplicating version or feature flags', () => {
    const activeGames = createActiveGames();

    const activeGame = activeGames.store('game-one', WAITING_STATE);

    expect(activeGame).toEqual({
      connectionsByUserId: new Map(),
      state: WAITING_STATE,
    });
  });

  test('runs operations for one game sequentially', async () => {
    const activeGames = createActiveGames();
    const operationOrder: string[] = [];
    let releaseFirstOperation: (() => void) | undefined;
    const firstOperationGate = new Promise<void>((resolve) => {
      releaseFirstOperation = resolve;
    });

    const firstOperation = activeGames.runExclusive('game-one', async () => {
      operationOrder.push('first-started');
      await firstOperationGate;
      operationOrder.push('first-finished');
    });
    const secondOperation = activeGames.runExclusive('game-one', () => {
      operationOrder.push('second-started');
    });
    await vi.waitFor(() => {
      expect(operationOrder).toEqual(['first-started']);
    });

    releaseFirstOperation?.();
    await Promise.all([firstOperation, secondOperation]);

    expect(operationOrder).toEqual([
      'first-started',
      'first-finished',
      'second-started',
    ]);
  });

  test('does not block operations for different games', async () => {
    const activeGames = createActiveGames();
    let releaseFirstGame: (() => void) | undefined;
    const firstGameGate = new Promise<void>((resolve) => {
      releaseFirstGame = resolve;
    });
    const secondGameOperation = vi.fn();

    const firstOperation = activeGames.runExclusive('game-one', async () => {
      await firstGameGate;
    });
    const secondOperation = activeGames.runExclusive('game-two', () => {
      secondGameOperation();
    });

    await secondOperation;
    expect(secondGameOperation).toHaveBeenCalledOnce();

    releaseFirstGame?.();
    await firstOperation;
  });
});
