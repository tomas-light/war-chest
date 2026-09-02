import type { GameEventData, GameState } from '@war-chest/game-engine';
import { calculateBackgroundTaskRetryDelay } from './calculateBackgroundTaskRetryDelay.js';
import type { ReconnectDeadlineInput } from './GameServiceTypes.js';
import { getCurrentDate } from './getCurrentDate.js';

interface DeadlineTimer {
  deadline: string;
  handle: NodeJS.Timeout;
}

interface Options {
  processDeadline(input: ReconnectDeadlineInput): Promise<void>;
}

export interface ReconnectDeadline {
  clear(this: void, gameId: string, playerId: string): void;
  close(this: void): void;
  restore(this: void, gameId: string, state: GameState): void;
  schedule(this: void, input: ReconnectDeadlineInput): void;
  update(this: void, gameId: string, events: readonly GameEventData[]): void;
}

export function createReconnectDeadline(options: Options): ReconnectDeadline {
  const deadlineTimers = new Map<string, DeadlineTimer>();
  let isClosed = false;

  return { clear, close, restore, schedule, update };

  function close(): void {
    isClosed = true;

    for (const timer of deadlineTimers.values()) {
      clearTimeout(timer.handle);
    }

    deadlineTimers.clear();
  }

  function restore(gameId: string, state: GameState): void {
    for (const player of state.players) {
      clear(gameId, player.id);

      if (
        player.presence === 'disconnected' &&
        player.reconnectDeadline !== null
      ) {
        schedule({
          gameId,
          playerId: player.id,
          reconnectDeadline: player.reconnectDeadline,
          retryAttempt: 0,
        });
      }
    }
  }

  function update(gameId: string, events: readonly GameEventData[]): void {
    for (const event of events) {
      if (event.type === 'PlayerDisconnected') {
        schedule({
          gameId,
          playerId: event.payload.playerId,
          reconnectDeadline: event.payload.reconnectDeadline,
          retryAttempt: 0,
        });
      }

      if (
        event.type === 'PlayerReconnected' ||
        event.type === 'PlayerDefeated'
      ) {
        clear(gameId, event.payload.playerId);
      }
    }
  }

  function schedule(input: ReconnectDeadlineInput): void {
    if (isClosed) {
      return;
    }

    clear(input.gameId, input.playerId);
    const delayMs = calculateReconnectDeadlineDelay(input);
    const handle = setTimeout(handleDeadline, delayMs);
    const timerKey = createDeadlineTimerKey(input.gameId, input.playerId);

    deadlineTimers.set(timerKey, {
      deadline: input.reconnectDeadline,
      handle,
    });

    function handleDeadline(): void {
      const currentTimer = deadlineTimers.get(timerKey);

      if (currentTimer?.deadline !== input.reconnectDeadline) {
        return;
      }

      deadlineTimers.delete(timerKey);
      void options.processDeadline(input);
    }
  }

  function clear(gameId: string, playerId: string): void {
    const timerKey = createDeadlineTimerKey(gameId, playerId);
    const timer = deadlineTimers.get(timerKey);

    if (timer === undefined) {
      return;
    }

    clearTimeout(timer.handle);
    deadlineTimers.delete(timerKey);
  }
}

function calculateReconnectDeadlineDelay(
  input: ReconnectDeadlineInput
): number {
  if (input.retryAttempt === 0) {
    return Math.max(
      0,
      new Date(input.reconnectDeadline).getTime() - getCurrentDate().getTime()
    );
  }

  return calculateBackgroundTaskRetryDelay(input.retryAttempt);
}

function createDeadlineTimerKey(gameId: string, playerId: string): string {
  return `${gameId}:${playerId}`;
}
