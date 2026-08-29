import type { LobbyGame } from '@war-chest/api-contracts';
import {
  type GameView,
  type GameViewEventData,
  applyViewEvent,
} from '@war-chest/game-engine';
import { createStore } from 'zustand/vanilla';

type SynchronizationStatus = 'idle' | 'ready' | 'desynchronized';

interface GameSessionState {
  events: readonly GameViewEventData[];
  liveState: GameView | null;
  lobbyGame: LobbyGame | null;
  synchronizationStatus: SynchronizationStatus;
  viewedState: GameView | null;
  applyEvents(events: readonly GameViewEventData[]): void;
  hydrate(view: GameView, events?: readonly GameViewEventData[]): void;
  retainLobbyGame(game: LobbyGame): void;
  viewLiveState(): void;
}

export type GameSessionStore = ReturnType<typeof createGameSessionStore>;

export function createGameSessionStore() {
  return createStore<GameSessionState>()((set) => ({
    events: [],
    liveState: null,
    lobbyGame: null,
    synchronizationStatus: 'idle',
    viewedState: null,
    applyEvents(events) {
      set((state) => applyEvents(state, events));
    },
    hydrate(view, events = []) {
      set({
        events,
        liveState: view,
        synchronizationStatus: 'ready',
        viewedState: view,
      });
    },
    retainLobbyGame(game) {
      set({ lobbyGame: game });
    },
    viewLiveState() {
      set((state) => ({ viewedState: state.liveState }));
    },
  }));
}

function applyEvents(
  state: GameSessionState,
  receivedEvents: readonly GameViewEventData[]
): Partial<GameSessionState> {
  let liveState = state.liveState;
  const newEvents: GameViewEventData[] = [];

  for (const event of receivedEvents) {
    const lastSequence = liveState?.lastEventSequence ?? 0;

    if (event.sequence <= lastSequence) {
      continue;
    }

    if (event.sequence !== lastSequence + 1) {
      return { synchronizationStatus: 'desynchronized' };
    }

    liveState = applyViewEvent(liveState, event);
    newEvents.push(event);
  }

  return {
    events: [...state.events, ...newEvents],
    liveState,
    synchronizationStatus: liveState === null ? 'idle' : 'ready',
    viewedState: liveState,
  };
}
