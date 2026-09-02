import {
  type GameEventData,
  type GameState,
  type Viewer,
  restoreGame,
} from '@war-chest/game-engine';
import type { ActiveGame, ActiveGames } from '../ActiveGames.js';
import type { GameRepository } from '../GameRepository.js';
import type { EmptyWaitingGameExpiration } from './EmptyWaitingGameExpiration.js';
import type { ReconnectDeadline } from './ReconnectDeadline.js';

interface Options {
  activeGames: ActiveGames;
  emptyWaitingGameExpiration: EmptyWaitingGameExpiration;
  gameRepository: GameRepository;
  reconnectDeadline: ReconnectDeadline;
}

interface ResolveViewerInput {
  gameId: string;
  state: GameState;
  userId: string;
}

interface ValidateEventTailInput {
  afterSequence: number;
  currentVersion: number;
  events: readonly GameEventData[];
  gameId: string;
}

export interface GameLoader {
  load(this: void, gameId: string): Promise<ActiveGame | null>;
  reload(this: void, gameId: string): Promise<ActiveGame | null>;
  resolveViewer(this: void, input: ResolveViewerInput): Promise<Viewer>;
}

export function createGameLoader(options: Options): GameLoader {
  return { load, reload, resolveViewer };

  async function load(gameId: string): Promise<ActiveGame | null> {
    const cachedGame = options.activeGames.get(gameId);

    if (cachedGame !== null) {
      return cachedGame;
    }

    return loadStoredGame(gameId);
  }

  async function reload(gameId: string): Promise<ActiveGame | null> {
    return loadStoredGame(gameId);
  }

  async function loadStoredGame(gameId: string): Promise<ActiveGame | null> {
    const storedGame = await options.gameRepository.findGame(gameId);

    if (storedGame === null) {
      return null;
    }

    const events = await options.gameRepository.loadEvents(gameId);
    validateStoredHistory(gameId, events, storedGame.currentVersion);
    const state = restoreGame(events);

    if (state === null) {
      throw new Error(`Stored game ${gameId} has an empty history.`);
    }

    if (state.status === 'finished') {
      options.emptyWaitingGameExpiration.clear(gameId);
      options.activeGames.delete(gameId);
      return {
        connectionsByUserId: new Map<string, Set<string>>(),
        state,
      };
    }

    const activeGame = options.activeGames.store(gameId, state);
    options.emptyWaitingGameExpiration.update(
      gameId,
      storedGame.createdAt,
      state
    );
    options.reconnectDeadline.restore(gameId, state);

    return activeGame;
  }

  async function resolveViewer(input: ResolveViewerInput): Promise<Viewer> {
    const participant = await options.gameRepository.findParticipant(
      input.gameId,
      input.userId
    );
    const isPlayer =
      participant !== null &&
      input.state.players.some((player) => player.id === input.userId);

    return isPlayer
      ? { playerId: input.userId, role: 'player' }
      : { role: 'spectator' };
  }
}

function validateStoredHistory(
  gameId: string,
  events: readonly GameEventData[],
  currentVersion: number
): void {
  const [firstEvent] = events;

  if (firstEvent?.type !== 'GameCreated' || firstEvent.sequence !== 1) {
    throw new Error(`Stored game ${gameId} does not start with GameCreated.`);
  }

  validateEventTail({ afterSequence: 0, currentVersion, events, gameId });
}

function validateEventTail(input: ValidateEventTailInput): void {
  for (const [index, event] of input.events.entries()) {
    const expectedSequence = input.afterSequence + index + 1;

    if (event.sequence !== expectedSequence) {
      throw new Error(
        `Stored game ${input.gameId} has a sequence gap before ${event.sequence}.`
      );
    }
  }

  const lastSequence = input.events.at(-1)?.sequence ?? input.afterSequence;

  if (lastSequence !== input.currentVersion) {
    throw new Error(
      `Stored game ${input.gameId} history ends at ${lastSequence}, expected ${input.currentVersion}.`
    );
  }
}
