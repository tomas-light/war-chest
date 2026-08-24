import type { GameState } from '@war-chest/game-engine';

export interface ActiveGame {
  connectionsByUserId: Map<string, Set<string>>;
  state: GameState;
}

export interface ActiveGames {
  delete(this: void, gameId: string): void;
  get(this: void, gameId: string): ActiveGame | null;
  runExclusive<Result>(
    this: void,
    gameId: string,
    operation: () => Result | Promise<Result>
  ): Promise<Result>;
  store(this: void, gameId: string, state: GameState): ActiveGame;
}

export function createActiveGames(): ActiveGames {
  const games = new Map<string, ActiveGame>();
  const gameLastOperations = new Map<string, Promise<void>>();

  return { delete: deleteGame, get, runExclusive, store };

  function deleteGame(gameId: string): void {
    games.delete(gameId);
  }

  function get(gameId: string): ActiveGame | null {
    return games.get(gameId) ?? null;
  }

  async function runExclusive<Result>(
    gameId: string,
    operation: () => Result | Promise<Result>
  ): Promise<Result> {
    const lastOperationPromise =
      gameLastOperations.get(gameId) ?? Promise.resolve();

    const operationPromise = lastOperationPromise.then(operation);

    const technicalOperation = operationPromise.then(
      () => undefined,
      () => undefined // allow to add next operation to the queue, even if the previous one failed
    );

    gameLastOperations.set(gameId, technicalOperation);

    try {
      return await operationPromise;
    } finally {
      if (gameLastOperations.get(gameId) === technicalOperation) {
        gameLastOperations.delete(gameId);
      }
    }
  }

  function store(gameId: string, state: GameState): ActiveGame {
    const activeGame = games.get(gameId) ?? {
      connectionsByUserId: new Map<string, Set<string>>(),
      state,
    };

    activeGame.state = state;
    games.set(gameId, activeGame);

    return activeGame;
  }
}
