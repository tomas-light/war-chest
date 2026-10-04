import type { GameViewEventData } from '@war-chest/game-engine';
import {
  type GameSessionStore,
  restoreHistoricalView,
} from '#/entities/game-session';

export type ReplayStatus =
  'idle' | 'review' | 'loading' | 'playing' | 'paused' | 'error';

interface Options {
  gameSessionStore: GameSessionStore;
  loadEvents(
    this: void,
    sequence: number
  ): Promise<readonly GameViewEventData[]>;
  onStatusChange(this: void, status: ReplayStatus, error: unknown): void;
}

export function createGameReplayController(options: Options) {
  const { gameSessionStore, loadEvents, onStatusChange } = options;

  let operation = 0;
  let requestedSequence: number | null = null;
  let resumeOnRetry = false;

  return {
    advanceReplay,
    cancelPendingOperation,
    pauseReplay,
    playReplay,
    returnToLive,
    retryReplay,
    viewHistory,
  };

  async function viewHistory(sequence: number): Promise<void> {
    const request = ++operation;
    requestedSequence = sequence;
    resumeOnRetry = false;
    onStatusChange('loading', null);

    try {
      const events = await loadEvents(
        gameSessionStore.getState().liveState?.lastEventSequence ?? sequence
      );
      const view = restoreHistoricalView(events, sequence);

      if (request !== operation) {
        return;
      }

      gameSessionStore.getState().viewHistoricalState(view);
      onStatusChange('review', null);
    } catch (error: unknown) {
      failOperation(request, error);
    }
  }

  function returnToLive(): void {
    cancelPendingOperation();
    requestedSequence = null;
    resumeOnRetry = false;
    gameSessionStore.getState().viewLiveState();
    onStatusChange('idle', null);
  }

  function playReplay(): void {
    cancelPendingOperation();
    onStatusChange('playing', null);
  }

  function pauseReplay(): void {
    cancelPendingOperation();
    onStatusChange('paused', null);
  }

  function retryReplay(): void {
    if (resumeOnRetry) {
      playReplay();
    } else if (requestedSequence !== null) {
      void viewHistory(requestedSequence);
    }
  }

  async function advanceReplay(): Promise<void> {
    const request = ++operation;
    const { liveState, viewedState } = gameSessionStore.getState();

    if (
      liveState === null ||
      viewedState === null ||
      viewedState.lastEventSequence >= liveState.lastEventSequence
    ) {
      returnToLive();
      return;
    }

    resumeOnRetry = true;
    onStatusChange('loading', null);

    try {
      const events = await loadEvents(liveState.lastEventSequence);

      if (request !== operation) {
        return;
      }

      restoreHistoricalView(events, liveState.lastEventSequence);
      const nextTurn = events.find(
        (event) =>
          event.sequence > viewedState.lastEventSequence &&
          (event.type === 'TurnPassed' || event.type === 'TurnActionPerformed')
      );

      if (nextTurn === undefined) {
        returnToLive();
        return;
      }

      requestedSequence = nextTurn.sequence;
      const view = restoreHistoricalView(events, nextTurn.sequence);
      gameSessionStore.getState().viewHistoricalState(view);

      if (
        view.lastEventSequence >=
        (gameSessionStore.getState().liveState?.lastEventSequence ?? 0)
      ) {
        returnToLive();
      } else {
        onStatusChange('playing', null);
      }
    } catch (error: unknown) {
      failOperation(request, error);
    }
  }

  function cancelPendingOperation(): void {
    operation += 1;
  }

  function failOperation(request: number, error: unknown): void {
    if (request === operation) {
      onStatusChange('error', error);
    }
  }
}
