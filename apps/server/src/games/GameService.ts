import { createHash } from 'node:crypto';
import type { LobbyGame, LobbyGamesResponse } from '@war-chest/api-contracts';
import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import {
  type GameCommandData,
  type GameEventData,
  type GameState,
  type GameView,
  type GameViewEventData,
  type JoinGameCommandData,
  type JsonValue,
  type Viewer,
  applyEvent,
  createGame as createGameEvent,
  createViewEventFor,
  createViewFor,
  decide,
  decidePresence,
  restoreGame,
} from '@war-chest/game-engine';
import type { FeatureFlagsService } from '../featureFlags/FeatureFlagsService.js';
import { createPublicUser } from '../users/PublicUser.js';
import type { ActiveGame, ActiveGames } from './ActiveGames.js';
import type { GameRepository, StoredParticipant } from './GameRepository.js';

const RECONNECT_DEADLINE_RETRY_BASE_DELAY_MS = 1_000;
const RECONNECT_DEADLINE_RETRY_MAX_DELAY_MS = 60_000;

interface CreateGameInput {
  commandId: string;
  userId: string;
}

type CreateGameResult =
  | { gameId: string; status: 'created'; view: GameView }
  | { gameId: string; status: 'duplicateCommand'; view: GameView }
  | { status: 'commandIdConflict' }
  | { status: 'featureFlagsUnavailable' }
  | { gameId: string; status: 'playerAlreadyInGame' };

type DuplicateCreateGameResult = Extract<
  CreateGameResult,
  { status: 'duplicateCommand' }
>;

interface ExecuteGameCommandInput {
  command: GameCommandData;
  commandId: string;
  expectedVersion: number;
  gameId: string;
  userId: string;
}

type CreateGameRequestIdentity = Pick<CreateGameInput, 'userId'> & {
  operation: 'CreateGame';
};

type GameCommandRequestIdentity = Pick<
  ExecuteGameCommandInput,
  'command' | 'expectedVersion' | 'gameId' | 'userId'
>;

type RequestIdentity = CreateGameRequestIdentity | GameCommandRequestIdentity;

interface CanonicalizableObject {
  readonly [name: string]: CanonicalizableValue | undefined;
}

type CanonicalizableValue =
  CanonicalizableObject | GameCommandData | JsonValue | RequestIdentity;

interface CreateSynchronizationInput {
  afterSequence: number;
  gameId: string;
  state: GameState;
  viewer: Viewer;
}

interface CreateViewEventTailInput {
  afterSequence: number;
  currentVersion: number;
  gameId: string;
  viewer: Viewer;
}

interface ValidateEventTailInput {
  afterSequence: number;
  currentVersion: number;
  events: readonly GameEventData[];
  gameId: string;
}

interface CheckJoinGamePreconditionsInput {
  command: JoinGameCommandData;
  participant: StoredParticipant | null;
  state: GameState;
  userId: string;
}

interface CheckCommandAccessInput {
  command: GameCommandData;
  participant: StoredParticipant | null;
  state: GameState;
  userId: string;
}

interface SavedCommandResult {
  currentVersion: number;
  events: readonly GameViewEventData[];
  previousVersion: number;
  status: 'saved';
  view: GameView;
}

export type ExecuteGameCommandResult =
  | SavedCommandResult
  | {
      currentVersion: number;
      status: 'duplicateCommand';
      synchronization: GameSynchronization;
    }
  | { currentVersion: number; status: 'versionConflict' }
  | { status: 'alreadyJoined'; view: GameView }
  | { status: 'commandIdConflict' }
  | { status: 'commandRejected' }
  | { status: 'gameCommandForbidden' }
  | { status: 'gameNotFound' }
  | { status: 'gamePositionOccupied' }
  | { gameId: string; status: 'playerAlreadyInGame' };

type CommandAccessResult = Extract<
  ExecuteGameCommandResult,
  { status: 'gameCommandForbidden' }
>;

type JoinGamePreconditionResult = Extract<
  ExecuteGameCommandResult,
  {
    status: 'alreadyJoined' | 'commandRejected' | 'gamePositionOccupied';
  }
>;

type GetGameSnapshotResult =
  | { gameId: string; status: 'found'; view: GameView }
  | { status: 'gameNotFound' };

type GetGameEventsResult =
  | {
      events: readonly GameViewEventData[];
      gameId: string;
      status: 'found';
    }
  | { status: 'gameNotFound' };

type SynchronizeGameResult =
  | {
      currentVersion: number;
      gameId: string;
      status: 'found';
      synchronization: GameSynchronization;
    }
  | { status: 'gameNotFound' };

export type GameSynchronization =
  | { events: readonly GameViewEventData[]; type: 'events' }
  | { type: 'snapshot'; view: GameView };

interface SynchronizeGameInput {
  afterSequence: number;
  gameId: string;
  userId: string;
}

interface GetGameSnapshotInput {
  gameId: string;
  userId: string;
}

interface GetGameEventsInput {
  afterSequence: number;
  gameId: string;
  userId: string;
}

interface GameConnectionInput {
  connectionId: string;
  gameId: string;
  userId: string;
}

type ConnectToGameResult =
  | { gameId: string; status: 'connected'; view: GameView }
  | {
      currentVersion: number;
      gameId: string;
      previousVersion: number;
      status: 'reconnected';
      view: GameView;
    }
  | { status: 'gameNotFound' };

type DisconnectFromGameResult =
  | {
      currentVersion: number;
      previousVersion: number;
      status: 'disconnected';
    }
  | { status: 'noChange' };

export interface GameUpdate {
  gameId: string;
  previousVersion: number;
}

type GameUpdateListener = (update: GameUpdate) => Promise<void> | void;

interface DeadlineTimer {
  deadline: string;
  handle: NodeJS.Timeout;
}

interface ReconnectDeadlineInput {
  gameId: string;
  playerId: string;
  reconnectDeadline: string;
  retryAttempt: number;
}

interface CreateGameServiceOptions {
  activeGames: ActiveGames;
  disconnectedPlayerTimeoutMs: number;
  featureFlagsService: FeatureFlagsService;
  gameRepository: GameRepository;
}

interface ListLobbyGamesInput {
  userId: string;
}

interface ProjectionChanges {
  gameChanges?: {
    finishedAt?: Date;
    startedAt?: Date;
    status?: 'active' | 'finished';
    winnerTeam?: 'black' | 'white';
  };
  participantChanges?: readonly (
    | {
        operation: 'addPlayer';
        seat: number;
        team: 'black' | 'white';
        userId: string;
      }
    | {
        operation: 'movePlayer';
        seat: number;
        team: 'black' | 'white';
        userId: string;
      }
    | {
        operation: 'swapPlayers';
        positions: [
          { seat: number; team: 'black' | 'white'; userId: string },
          { seat: number; team: 'black' | 'white'; userId: string },
        ];
      }
  )[];
}

export interface GameService {
  close(this: void): void;
  connect(this: void, input: GameConnectionInput): Promise<ConnectToGameResult>;
  createGame(this: void, input: CreateGameInput): Promise<CreateGameResult>;
  disconnect(
    this: void,
    input: GameConnectionInput
  ): Promise<DisconnectFromGameResult>;
  executeCommand(
    this: void,
    input: ExecuteGameCommandInput
  ): Promise<ExecuteGameCommandResult>;
  getEvents(
    this: void,
    input: GetGameEventsInput
  ): Promise<GetGameEventsResult>;
  getSnapshot(
    this: void,
    input: GetGameSnapshotInput
  ): Promise<GetGameSnapshotResult>;
  listLobbyGames(
    this: void,
    input: ListLobbyGamesInput
  ): Promise<LobbyGamesResponse>;
  recoverActiveGames(this: void): Promise<void>;
  subscribe(this: void, listener: GameUpdateListener): () => void;
  synchronize(
    this: void,
    input: SynchronizeGameInput
  ): Promise<SynchronizeGameResult>;
}

export function createGameService(
  options: CreateGameServiceOptions
): GameService {
  const deadlineTimers = new Map<string, DeadlineTimer>();
  const updateListeners = new Set<GameUpdateListener>();
  let isClosed = false;

  return {
    close,
    connect,
    createGame,
    disconnect,
    executeCommand,
    getEvents,
    getSnapshot,
    listLobbyGames,
    recoverActiveGames,
    subscribe,
    synchronize,
  };

  function close(): void {
    isClosed = true;

    for (const timer of deadlineTimers.values()) {
      clearTimeout(timer.handle);
    }

    deadlineTimers.clear();
    updateListeners.clear();
  }

  async function connect(
    input: GameConnectionInput
  ): Promise<ConnectToGameResult> {
    return options.activeGames.runExclusive(input.gameId, async () => {
      const activeGame = await loadGame(input.gameId);

      if (activeGame === null) {
        return { status: 'gameNotFound' };
      }

      const connectionIds =
        activeGame.connectionsByUserId.get(input.userId) ?? new Set<string>();

      connectionIds.add(input.connectionId);
      activeGame.connectionsByUserId.set(input.userId, connectionIds);
      const previousVersion = activeGame.state.lastEventSequence;
      const reconnectedEvents = decidePresence(activeGame.state, {
        playerId: input.userId,
        reconnectedAt: getCurrentDate().toISOString(),
        type: 'ReconnectPlayer',
      });

      if (reconnectedEvents.length > 0) {
        const update = await savePresenceEvents(
          input.gameId,
          activeGame,
          reconnectedEvents
        );

        if (update !== null) {
          notifyUpdate(update);
          const viewer = getPlayerViewer(input.userId);

          return {
            currentVersion: activeGame.state.lastEventSequence,
            gameId: input.gameId,
            previousVersion,
            status: 'reconnected',
            view: createViewFor(activeGame.state, viewer),
          };
        }
      }

      const currentGame = options.activeGames.get(input.gameId) ?? activeGame;
      const currentConnectionIds =
        currentGame.connectionsByUserId.get(input.userId) ?? new Set<string>();

      currentConnectionIds.add(input.connectionId);
      currentGame.connectionsByUserId.set(input.userId, currentConnectionIds);
      const viewer = await resolveViewer(
        input.gameId,
        input.userId,
        currentGame.state
      );

      return {
        gameId: input.gameId,
        status: 'connected',
        view: createViewFor(currentGame.state, viewer),
      };
    });
  }

  async function createGame(input: CreateGameInput): Promise<CreateGameResult> {
    const requestHash = createRequestHash({
      operation: 'CreateGame',
      userId: input.userId,
    });
    const existingCommand = await options.gameRepository.findProcessedCommand(
      input.commandId
    );

    if (existingCommand !== null) {
      const isExactDuplicate =
        existingCommand.userId === input.userId &&
        existingCommand.commandType === 'CreateGame' &&
        existingCommand.requestHash === requestHash;

      if (!isExactDuplicate) {
        return { status: 'commandIdConflict' };
      }

      return loadDuplicateCreatedGame(existingCommand.gameId, input.userId);
    }

    const currentPlayerGameId =
      await options.gameRepository.findCurrentPlayerGame(input.userId);

    if (currentPlayerGameId !== null) {
      return {
        gameId: currentPlayerGameId,
        status: 'playerAlreadyInGame',
      };
    }

    let featureFlags: RuntimeFeatureFlags;

    try {
      featureFlags = await options.featureFlagsService.read();
    } catch {
      return { status: 'featureFlagsUnavailable' };
    }

    const gameCreatedEvent = createGameEvent({
      creatorId: input.userId,
      featureFlags,
      type: 'CreateGame',
    });
    const result = await options.gameRepository.createGame({
      commandId: input.commandId,
      creatorUserId: input.userId,
      event: gameCreatedEvent,
      requestHash,
    });

    if (result.status === 'commandIdConflict') {
      return result;
    }

    if (result.status === 'duplicateCommand') {
      return loadDuplicateCreatedGame(result.gameId, input.userId);
    }

    const state = applyEvent(null, gameCreatedEvent);
    options.activeGames.store(result.gameId, state);
    notifyUpdate({ gameId: result.gameId, previousVersion: 0 });

    return {
      gameId: result.gameId,
      status: 'created',
      view: createViewFor(state, { role: 'spectator' }),
    };
  }

  async function loadDuplicateCreatedGame(
    gameId: string,
    userId: string
  ): Promise<DuplicateCreateGameResult> {
    const loadedGame = await loadGame(gameId);

    if (loadedGame === null) {
      throw new Error(`Created game ${gameId} does not exist.`);
    }

    const viewer = await resolveViewer(gameId, userId, loadedGame.state);

    return {
      gameId,
      status: 'duplicateCommand',
      view: createViewFor(loadedGame.state, viewer),
    };
  }

  async function listLobbyGames(
    input: ListLobbyGamesInput
  ): Promise<LobbyGamesResponse> {
    const storedGames = await options.gameRepository.listLobbyGames();
    const currentPlayerGameId =
      await options.gameRepository.findCurrentPlayerGame(input.userId);

    return {
      currentPlayerGameId,
      items: storedGames.map(createLobbyGame),
    };

    function createLobbyGame(game: (typeof storedGames)[number]): LobbyGame {
      return {
        createdAt: game.createdAt.toISOString(),
        id: game.id,
        players: game.players.map((player) => ({
          ...createPublicUser(player),
          seat: player.seat,
          team: player.team,
        })),
        startedAt: game.startedAt?.toISOString() ?? null,
        status: game.status,
      };
    }
  }

  async function disconnect(
    input: GameConnectionInput
  ): Promise<DisconnectFromGameResult> {
    return options.activeGames.runExclusive(input.gameId, async () => {
      const activeGame = options.activeGames.get(input.gameId);
      const connectionIds = activeGame?.connectionsByUserId.get(input.userId);

      if (activeGame === null || connectionIds === undefined) {
        return { status: 'noChange' };
      }

      connectionIds.delete(input.connectionId);

      if (connectionIds.size === 0) {
        activeGame.connectionsByUserId.delete(input.userId);
      } else {
        return { status: 'noChange' };
      }

      const reconnectDeadline = new Date(
        getCurrentDate().getTime() + options.disconnectedPlayerTimeoutMs
      ).toISOString();
      const events = decidePresence(activeGame.state, {
        playerId: input.userId,
        reconnectDeadline,
        type: 'DisconnectPlayer',
      });

      if (events.length === 0) {
        return { status: 'noChange' };
      }

      const previousVersion = activeGame.state.lastEventSequence;
      const update = await savePresenceEvents(input.gameId, activeGame, events);

      if (update === null) {
        return { status: 'noChange' };
      }

      notifyUpdate(update);

      return {
        currentVersion: activeGame.state.lastEventSequence,
        previousVersion,
        status: 'disconnected',
      };
    });
  }

  async function executeCommand(
    input: ExecuteGameCommandInput
  ): Promise<ExecuteGameCommandResult> {
    return options.activeGames.runExclusive(input.gameId, async () => {
      const requestHash = createRequestHash({
        command: input.command,
        expectedVersion: input.expectedVersion,
        gameId: input.gameId,
        userId: input.userId,
      });
      const existingCommand = await options.gameRepository.findProcessedCommand(
        input.commandId
      );

      if (existingCommand !== null) {
        const isExactDuplicate =
          existingCommand.gameId === input.gameId &&
          existingCommand.userId === input.userId &&
          existingCommand.commandType === input.command.type &&
          existingCommand.requestHash === requestHash;

        if (!isExactDuplicate) {
          return { status: 'commandIdConflict' };
        }

        const loadedGame = await reloadGame(input.gameId);

        if (loadedGame === null) {
          return { status: 'gameNotFound' };
        }

        const viewer = await resolveViewer(
          input.gameId,
          input.userId,
          loadedGame.state
        );

        return {
          currentVersion: loadedGame.state.lastEventSequence,
          status: 'duplicateCommand',
          synchronization: await createSynchronization({
            afterSequence: input.expectedVersion,
            gameId: input.gameId,
            state: loadedGame.state,
            viewer,
          }),
        };
      }

      const activeGame = await loadGame(input.gameId);

      if (activeGame === null) {
        return { status: 'gameNotFound' };
      }

      if (input.expectedVersion !== activeGame.state.lastEventSequence) {
        return {
          currentVersion: activeGame.state.lastEventSequence,
          status: 'versionConflict',
        };
      }

      const participant = await options.gameRepository.findParticipant(
        input.gameId,
        input.userId
      );
      const commandAccessResult = checkCommandAccess({
        command: input.command,
        participant,
        state: activeGame.state,
        userId: input.userId,
      });

      if (commandAccessResult !== null) {
        return commandAccessResult;
      }

      if (input.command.type === 'JoinGame') {
        const currentPlayerGameId =
          await options.gameRepository.findCurrentPlayerGame(input.userId);

        if (
          currentPlayerGameId !== null &&
          currentPlayerGameId !== input.gameId
        ) {
          return {
            gameId: currentPlayerGameId,
            status: 'playerAlreadyInGame',
          };
        }

        const joinGamePreconditionResult = checkJoinGamePreconditions({
          command: input.command,
          participant,
          state: activeGame.state,
          userId: input.userId,
        });

        if (joinGamePreconditionResult !== null) {
          return joinGamePreconditionResult;
        }
      }

      const events = decide(activeGame.state, input.userId, input.command);

      if (events.length === 0) {
        return { status: 'commandRejected' };
      }

      const previousVersion = activeGame.state.lastEventSequence;
      const projectionChanges = createProjectionChanges(
        events,
        getCurrentDate()
      );
      const saveResult = await options.gameRepository.saveCommand({
        commandId: input.commandId,
        commandType: input.command.type,
        events,
        expectedVersion: input.expectedVersion,
        gameChanges: projectionChanges.gameChanges,
        gameId: input.gameId,
        participantChanges: projectionChanges.participantChanges,
        requestHash,
        userId: input.userId,
      });

      if (saveResult.status === 'commandIdConflict') {
        return saveResult;
      }

      if (saveResult.status === 'playerAlreadyInGame') {
        const currentPlayerGameId =
          await options.gameRepository.findCurrentPlayerGame(input.userId);

        return {
          gameId: currentPlayerGameId ?? input.gameId,
          status: 'playerAlreadyInGame',
        };
      }

      if (saveResult.status === 'versionConflict') {
        await reloadGame(input.gameId);
        return saveResult;
      }

      if (saveResult.status === 'duplicateCommand') {
        const loadedGame = await reloadGame(input.gameId);

        if (loadedGame === null) {
          throw new Error(`Stored game ${input.gameId} does not exist.`);
        }

        const viewer = await resolveViewer(
          input.gameId,
          input.userId,
          loadedGame.state
        );

        return {
          currentVersion: loadedGame.state.lastEventSequence,
          status: 'duplicateCommand',
          synchronization: await createSynchronization({
            afterSequence: input.expectedVersion,
            gameId: input.gameId,
            state: loadedGame.state,
            viewer,
          }),
        };
      }

      const nextState = events.reduce(applyEvent, activeGame.state);
      activeGame.state = nextState;
      const viewer: Viewer =
        input.command.type === 'JoinGame' || participant !== null
          ? getPlayerViewer(input.userId)
          : { role: 'spectator' };
      const result: SavedCommandResult = {
        currentVersion: nextState.lastEventSequence,
        events: events.map((event) => createViewEventFor(event, viewer)),
        previousVersion,
        status: 'saved',
        view: createViewFor(nextState, viewer),
      };

      if (nextState.status === 'finished') {
        options.activeGames.delete(input.gameId);
      }

      notifyUpdate({ gameId: input.gameId, previousVersion });

      return result;
    });
  }

  async function getSnapshot(
    input: GetGameSnapshotInput
  ): Promise<GetGameSnapshotResult> {
    return options.activeGames.runExclusive(input.gameId, async () => {
      const activeGame = await loadGame(input.gameId);

      if (activeGame === null) {
        return { status: 'gameNotFound' };
      }

      const viewer = await resolveViewer(
        input.gameId,
        input.userId,
        activeGame.state
      );

      return {
        gameId: input.gameId,
        status: 'found',
        view: createViewFor(activeGame.state, viewer),
      };
    });
  }

  async function getEvents(
    input: GetGameEventsInput
  ): Promise<GetGameEventsResult> {
    return options.activeGames.runExclusive(input.gameId, async () => {
      const activeGame = await loadGame(input.gameId);

      if (activeGame === null) {
        return { status: 'gameNotFound' };
      }

      const viewer = await resolveViewer(
        input.gameId,
        input.userId,
        activeGame.state
      );
      const events =
        input.afterSequence > activeGame.state.lastEventSequence
          ? []
          : await createViewEventTail({
              afterSequence: input.afterSequence,
              currentVersion: activeGame.state.lastEventSequence,
              gameId: input.gameId,
              viewer,
            });

      return { events, gameId: input.gameId, status: 'found' };
    });
  }

  async function synchronize(
    input: SynchronizeGameInput
  ): Promise<SynchronizeGameResult> {
    return options.activeGames.runExclusive(input.gameId, async () => {
      const activeGame = await loadGame(input.gameId);

      if (activeGame === null) {
        return { status: 'gameNotFound' };
      }

      const viewer = await resolveViewer(
        input.gameId,
        input.userId,
        activeGame.state
      );

      return {
        currentVersion: activeGame.state.lastEventSequence,
        gameId: input.gameId,
        status: 'found',
        synchronization: await createSynchronization({
          afterSequence: input.afterSequence,
          gameId: input.gameId,
          state: activeGame.state,
          viewer,
        }),
      };
    });
  }

  async function recoverActiveGames(): Promise<void> {
    const gameIds = await options.gameRepository.findActiveGameIds();

    await Promise.all(
      gameIds.map((gameId) =>
        options.activeGames.runExclusive(gameId, async () => {
          await loadGame(gameId);
        })
      )
    );
  }

  function subscribe(listener: GameUpdateListener): () => void {
    updateListeners.add(listener);

    return unsubscribe;

    function unsubscribe(): void {
      updateListeners.delete(listener);
    }
  }

  async function loadGame(gameId: string): Promise<ActiveGame | null> {
    const cachedGame = options.activeGames.get(gameId);

    if (cachedGame !== null) {
      return cachedGame;
    }

    return loadStoredGame(gameId);
  }

  async function reloadGame(gameId: string): Promise<ActiveGame | null> {
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
      options.activeGames.delete(gameId);
      return {
        connectionsByUserId: new Map<string, Set<string>>(),
        state,
      };
    }

    const activeGame = options.activeGames.store(gameId, state);
    restoreDeadlineTimers(gameId, state);

    return activeGame;
  }

  async function resolveViewer(
    gameId: string,
    userId: string,
    state: GameState
  ): Promise<Viewer> {
    const participant = await options.gameRepository.findParticipant(
      gameId,
      userId
    );
    const isPlayer =
      participant !== null &&
      state.players.some((player) => player.id === userId);

    return isPlayer
      ? { playerId: userId, role: 'player' }
      : { role: 'spectator' };
  }

  async function createSynchronization(
    input: CreateSynchronizationInput
  ): Promise<GameSynchronization> {
    if (input.afterSequence > input.state.lastEventSequence) {
      return {
        type: 'snapshot',
        view: createViewFor(input.state, input.viewer),
      };
    }

    return {
      events: await createViewEventTail({
        afterSequence: input.afterSequence,
        currentVersion: input.state.lastEventSequence,
        gameId: input.gameId,
        viewer: input.viewer,
      }),
      type: 'events',
    };
  }

  async function createViewEventTail(
    input: CreateViewEventTailInput
  ): Promise<readonly GameViewEventData[]> {
    const events = await options.gameRepository.loadEvents(
      input.gameId,
      input.afterSequence
    );
    validateEventTail({
      afterSequence: input.afterSequence,
      currentVersion: input.currentVersion,
      events,
      gameId: input.gameId,
    });

    return events.map((event) => createViewEventFor(event, input.viewer));
  }

  async function savePresenceEvents(
    gameId: string,
    activeGame: ActiveGame,
    events: readonly GameEventData[]
  ): Promise<GameUpdate | null> {
    const previousVersion = activeGame.state.lastEventSequence;
    const projectionChanges = createProjectionChanges(events, getCurrentDate());
    const saveResult = await options.gameRepository.saveSystemEvents({
      events,
      expectedVersion: previousVersion,
      gameChanges: projectionChanges.gameChanges,
      gameId,
    });

    if (saveResult.status === 'versionConflict') {
      await reloadGame(gameId);
      return null;
    }

    activeGame.state = events.reduce(applyEvent, activeGame.state);
    updateDeadlineTimers(gameId, events);

    if (activeGame.state.status === 'finished') {
      options.activeGames.delete(gameId);
    }

    return { gameId, previousVersion };
  }

  function restoreDeadlineTimers(gameId: string, state: GameState): void {
    for (const player of state.players) {
      clearReconnectDeadline(gameId, player.id);

      if (
        player.presence === 'disconnected' &&
        player.reconnectDeadline !== null
      ) {
        scheduleReconnectDeadline({
          gameId,
          playerId: player.id,
          reconnectDeadline: player.reconnectDeadline,
          retryAttempt: 0,
        });
      }
    }
  }

  function updateDeadlineTimers(
    gameId: string,
    events: readonly GameEventData[]
  ): void {
    for (const event of events) {
      if (event.type === 'PlayerDisconnected') {
        scheduleReconnectDeadline({
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
        clearReconnectDeadline(gameId, event.payload.playerId);
      }
    }
  }

  function scheduleReconnectDeadline(input: ReconnectDeadlineInput): void {
    if (isClosed) {
      return;
    }

    clearReconnectDeadline(input.gameId, input.playerId);
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
      void processReconnectDeadline(input);
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

    return Math.min(
      RECONNECT_DEADLINE_RETRY_BASE_DELAY_MS * 2 ** (input.retryAttempt - 1),
      RECONNECT_DEADLINE_RETRY_MAX_DELAY_MS
    );
  }

  function clearReconnectDeadline(gameId: string, playerId: string): void {
    const timerKey = createDeadlineTimerKey(gameId, playerId);
    const timer = deadlineTimers.get(timerKey);

    if (timer === undefined) {
      return;
    }

    clearTimeout(timer.handle);
    deadlineTimers.delete(timerKey);
  }

  async function processReconnectDeadline(
    input: ReconnectDeadlineInput
  ): Promise<void> {
    await options.activeGames.runExclusive(input.gameId, processDeadline);

    async function processDeadline(): Promise<void> {
      try {
        await defeatDisconnectedPlayer();
      } catch {
        scheduleReconnectDeadline({
          ...input,
          retryAttempt: input.retryAttempt + 1,
        });
      }
    }

    async function defeatDisconnectedPlayer(): Promise<void> {
      const activeGame = await loadGame(input.gameId);
      const player = activeGame?.state.players.find(
        (candidate) => candidate.id === input.playerId
      );

      if (
        activeGame === null ||
        activeGame.state.status !== 'active' ||
        player?.presence !== 'disconnected' ||
        player.reconnectDeadline !== input.reconnectDeadline
      ) {
        return;
      }

      const defeatedAt = getCurrentDate().toISOString();
      const events = decidePresence(activeGame.state, {
        defeatedAt,
        playerId: input.playerId,
        reconnectDeadline: input.reconnectDeadline,
        type: 'DefeatDisconnectedPlayer',
      });

      if (events.length === 0) {
        scheduleReconnectDeadline({
          ...input,
          retryAttempt: input.retryAttempt + 1,
        });
        return;
      }

      const update = await savePresenceEvents(input.gameId, activeGame, events);

      if (update !== null) {
        notifyUpdate(update);
      }
    }
  }

  function notifyUpdate(update: GameUpdate): void {
    for (const listener of updateListeners) {
      void Promise.resolve()
        .then(() => listener(update))
        .catch(() => undefined);
    }
  }
}

function checkCommandAccess(
  input: CheckCommandAccessInput
): CommandAccessResult | null {
  if (input.command.type === 'JoinGame') {
    return null;
  }

  if (
    input.command.type === 'StartGame' ||
    input.command.type === 'SwapPlayerPositions'
  ) {
    return input.state.creatorId === input.userId
      ? null
      : { status: 'gameCommandForbidden' };
  }

  return input.participant === null ? { status: 'gameCommandForbidden' } : null;
}

function checkJoinGamePreconditions(
  input: CheckJoinGamePreconditionsInput
): JoinGamePreconditionResult | null {
  const isPositionOccupied = input.state.players.some(
    (player) =>
      player.id !== input.userId &&
      player.seat === input.command.seat &&
      player.team === input.command.team
  );

  if (isPositionOccupied) {
    return { status: 'gamePositionOccupied' };
  }

  if (input.participant === null) {
    return null;
  }

  const existingPlayer = input.state.players.find(
    (player) => player.id === input.userId
  );

  if (existingPlayer === undefined) {
    return { status: 'commandRejected' };
  }

  const hasRequestedPosition =
    existingPlayer.seat === input.command.seat &&
    existingPlayer.team === input.command.team;

  return hasRequestedPosition
    ? {
        status: 'alreadyJoined',
        view: createViewFor(input.state, getPlayerViewer(input.userId)),
      }
    : null;
}

function createProjectionChanges(
  events: readonly GameEventData[],
  occurredAt: Date
): ProjectionChanges {
  const gameChanges: NonNullable<ProjectionChanges['gameChanges']> = {};
  const participantChanges: NonNullable<
    ProjectionChanges['participantChanges']
  >[number][] = [];

  for (const event of events) {
    if (event.type === 'PlayerJoined') {
      participantChanges.push({
        operation: 'addPlayer',
        seat: event.payload.seat,
        team: event.payload.team,
        userId: event.payload.playerId,
      });
    }

    if (event.type === 'PlayerPositionChanged') {
      participantChanges.push({
        operation: 'movePlayer',
        seat: event.payload.seat,
        team: event.payload.team,
        userId: event.payload.playerId,
      });
    }

    if (event.type === 'PlayerPositionsSwapped') {
      const [firstPosition, secondPosition] = event.payload.positions;

      participantChanges.push({
        operation: 'swapPlayers',
        positions: [
          {
            seat: firstPosition.seat,
            team: firstPosition.team,
            userId: firstPosition.playerId,
          },
          {
            seat: secondPosition.seat,
            team: secondPosition.team,
            userId: secondPosition.playerId,
          },
        ],
      });
    }

    if (event.type === 'GameStarted') {
      gameChanges.startedAt = occurredAt;
      gameChanges.status = 'active';
    }

    if (event.type === 'GameFinished') {
      gameChanges.finishedAt = occurredAt;
      gameChanges.status = 'finished';
      gameChanges.winnerTeam = event.payload.winnerTeam;
    }
  }

  return {
    ...(Object.keys(gameChanges).length === 0 ? {} : { gameChanges }),
    ...(participantChanges.length === 0 ? {} : { participantChanges }),
  };
}

function getPlayerViewer(userId: string): Viewer {
  return { playerId: userId, role: 'player' };
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

function createRequestHash(requestIdentity: RequestIdentity): string {
  return createHash('sha256')
    .update(canonicalize(requestIdentity))
    .digest('hex');
}

function createDeadlineTimerKey(gameId: string, playerId: string): string {
  return `${gameId}:${playerId}`;
}

function canonicalize(requestIdentity: RequestIdentity): string {
  const serializedValue = JSON.stringify(requestIdentity, sortObjectKeys);

  if (serializedValue === undefined) {
    throw new Error('Request identity contains a non-JSON value.');
  }

  return serializedValue;
}

function sortObjectKeys(
  _propertyName: string,
  value: CanonicalizableValue | undefined
): CanonicalizableValue | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const objectValue = value as CanonicalizableObject;

  return Object.fromEntries(
    Object.entries(objectValue).sort(([firstName], [secondName]) =>
      firstName.localeCompare(secondName)
    )
  );
}

function getCurrentDate(): Date {
  return new Date();
}
