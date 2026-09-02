import type { GameState } from '@war-chest/game-engine';
import type { ActiveGames } from '../ActiveGames.js';
import type { GameRepository } from '../GameRepository.js';
import { calculateBackgroundTaskRetryDelay } from './calculateBackgroundTaskRetryDelay.js';
import type { EmptyWaitingGameExpirationInput } from './GameServiceTypes.js';
import type { GameUpdatePublisher } from './GameUpdatePublisher.js';
import { getCurrentDate } from './getCurrentDate.js';

const EMPTY_WAITING_GAME_VERSION = 1;

interface EmptyWaitingGameExpirationTimer {
  expiresAt: string;
  handle: NodeJS.Timeout;
}

interface Options {
  activeGames: ActiveGames;
  emptyWaitingGameTimeoutMs: number;
  gameRepository: GameRepository;
  gameUpdatePublisher: GameUpdatePublisher;
}

export interface EmptyWaitingGameExpiration {
  clear(this: void, gameId: string): void;
  close(this: void): void;
  createExpiresAt(this: void, createdAt: Date): string;
  process(this: void, input: EmptyWaitingGameExpirationInput): Promise<void>;
  schedule(this: void, input: EmptyWaitingGameExpirationInput): void;
  update(this: void, gameId: string, createdAt: Date, state: GameState): void;
  updateAfterCommand(this: void, gameId: string, state: GameState): void;
}

export function createEmptyWaitingGameExpiration(
  options: Options
): EmptyWaitingGameExpiration {
  const expirationTimers = new Map<string, EmptyWaitingGameExpirationTimer>();
  let isClosed = false;

  return {
    clear,
    close,
    createExpiresAt,
    process,
    schedule,
    update,
    updateAfterCommand,
  };

  function close(): void {
    isClosed = true;

    for (const timer of expirationTimers.values()) {
      clearTimeout(timer.handle);
    }

    expirationTimers.clear();
  }

  function update(gameId: string, createdAt: Date, state: GameState): void {
    clear(gameId);

    if (state.status !== 'waiting' || state.players.length > 0) {
      return;
    }

    schedule({
      expiresAt: createExpiresAt(createdAt),
      gameId,
      retryAttempt: 0,
    });
  }

  function updateAfterCommand(gameId: string, state: GameState): void {
    clear(gameId);

    if (state.status !== 'waiting' || state.players.length > 0) {
      return;
    }

    // Repository повторно проверит исходный createdAt под блокировкой. Если
    // игра ещё не просрочена, он вернёт точное время следующей проверки.
    schedule({
      expiresAt: getCurrentDate().toISOString(),
      gameId,
      retryAttempt: 0,
    });
  }

  function createExpiresAt(createdAt: Date): string {
    return new Date(
      createdAt.getTime() + options.emptyWaitingGameTimeoutMs
    ).toISOString();
  }

  function schedule(input: EmptyWaitingGameExpirationInput): void {
    if (isClosed) {
      return;
    }

    clear(input.gameId);
    const delayMs =
      input.retryAttempt === 0
        ? Math.max(
            0,
            new Date(input.expiresAt).getTime() - getCurrentDate().getTime()
          )
        : calculateBackgroundTaskRetryDelay(input.retryAttempt);
    const handle = setTimeout(handleExpiration, delayMs);

    expirationTimers.set(input.gameId, {
      expiresAt: input.expiresAt,
      handle,
    });

    function handleExpiration(): void {
      const currentTimer = expirationTimers.get(input.gameId);

      if (
        currentTimer?.expiresAt !== input.expiresAt ||
        currentTimer.handle !== handle
      ) {
        return;
      }

      expirationTimers.delete(input.gameId);
      void process(input);
    }
  }

  function clear(gameId: string): void {
    const timer = expirationTimers.get(gameId);

    if (timer === undefined) {
      return;
    }

    clearTimeout(timer.handle);
    expirationTimers.delete(gameId);
  }

  async function process(
    input: EmptyWaitingGameExpirationInput
  ): Promise<void> {
    await options.activeGames.runExclusive(input.gameId, expireWaitingGame);

    async function expireWaitingGame(): Promise<void> {
      try {
        const result = await options.gameRepository.deleteExpiredWaitingGame({
          expiredBefore: new Date(
            getCurrentDate().getTime() - options.emptyWaitingGameTimeoutMs
          ),
          gameId: input.gameId,
        });

        if (result.status === 'notExpired') {
          schedule({
            expiresAt: createExpiresAt(result.createdAt),
            gameId: input.gameId,
            retryAttempt: 0,
          });
          return;
        }

        if (result.status === 'notFound') {
          options.activeGames.delete(input.gameId);
          return;
        }

        if (result.status !== 'deleted') {
          return;
        }

        const previousVersion =
          options.activeGames.get(input.gameId)?.state.lastEventSequence ??
          EMPTY_WAITING_GAME_VERSION;

        options.activeGames.delete(input.gameId);
        options.gameUpdatePublisher.notify({
          gameId: input.gameId,
          previousVersion,
        });
      } catch {
        schedule({ ...input, retryAttempt: input.retryAttempt + 1 });
      }
    }
  }
}
