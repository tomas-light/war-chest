import type {
  LobbyGamePlayer,
  LobbyGamesResponse,
} from '@war-chest/api-contracts';
import type {
  GameCommandData,
  GameEventData,
  GameState,
  GameView,
  GameViewEventData,
  JoinGameCommandData,
  JsonValue,
  Viewer,
} from '@war-chest/game-engine';
import type { FeatureFlagsService } from '../../featureFlags/FeatureFlagsService.js';
import type { ActiveGames } from '../ActiveGames.js';
import type { GameRepository, StoredParticipant } from '../GameRepository.js';

export interface CreateGameInput {
  commandId: string;
  userId: string;
}

export type CreateGameResult =
  | { gameId: string; status: 'created'; view: GameView }
  | { gameId: string; status: 'duplicateCommand'; view: GameView }
  | { status: 'commandIdConflict' }
  | { status: 'featureFlagsUnavailable' }
  | { gameId: string; status: 'playerAlreadyInGame' };

export type DuplicateCreateGameResult = Extract<
  CreateGameResult,
  { status: 'duplicateCommand' }
>;

export interface ExecuteGameCommandInput {
  command: GameCommandData;
  commandId: string;
  expectedVersion: number;
  gameId: string;
  userId: string;
}

export type CreateGameRequestIdentity = Pick<CreateGameInput, 'userId'> & {
  operation: 'CreateGame';
};

export type GameCommandRequestIdentity = Pick<
  ExecuteGameCommandInput,
  'command' | 'expectedVersion' | 'gameId' | 'userId'
>;

export type RequestIdentity =
  CreateGameRequestIdentity | GameCommandRequestIdentity;

export interface CanonicalizableObject {
  readonly [name: string]: CanonicalizableValue | undefined;
}

export type CanonicalizableValue =
  CanonicalizableObject | GameCommandData | JsonValue | RequestIdentity;

export interface CreateSynchronizationInput {
  afterSequence: number;
  gameId: string;
  state: GameState;
  viewer: Viewer;
}

export interface CreateViewEventTailInput {
  afterSequence: number;
  currentVersion: number;
  gameId: string;
  viewer: Viewer;
}

export interface ValidateEventTailInput {
  afterSequence: number;
  currentVersion: number;
  events: readonly GameEventData[];
  gameId: string;
}

export interface CheckJoinGamePreconditionsInput {
  command: JoinGameCommandData;
  participant: StoredParticipant | null;
  state: GameState;
  userId: string;
}

export interface CheckCommandAccessInput {
  command: GameCommandData;
  participant: StoredParticipant | null;
  state: GameState;
  userId: string;
}

export interface SavedCommandResult {
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
  | { status: 'gameDeleted' }
  | { status: 'gameNotFound' }
  | { status: 'gamePositionOccupied' }
  | { gameId: string; status: 'playerAlreadyInGame' };

export type CommandAccessResult = Extract<
  ExecuteGameCommandResult,
  { status: 'gameCommandForbidden' }
>;

export type JoinGamePreconditionResult = Extract<
  ExecuteGameCommandResult,
  {
    status: 'alreadyJoined' | 'commandRejected' | 'gamePositionOccupied';
  }
>;

export type GetGameSnapshotResult =
  | {
      gameId: string;
      players: readonly LobbyGamePlayer[];
      status: 'found';
      view: GameView;
    }
  | { status: 'gameNotFound' };

export type GetGameEventsResult =
  | {
      events: readonly GameViewEventData[];
      gameId: string;
      status: 'found';
    }
  | { status: 'gameNotFound' };

export type SynchronizeGameResult =
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

export interface SynchronizeGameInput {
  afterSequence: number;
  gameId: string;
  userId: string;
}

export interface GetGameSnapshotInput {
  gameId: string;
  userId: string;
}

export interface GetGameEventsInput {
  afterSequence: number;
  gameId: string;
  userId: string;
}

export interface GameConnectionInput {
  connectionId: string;
  gameId: string;
  userId: string;
}

export type ConnectToGameResult =
  | { gameId: string; status: 'connected'; view: GameView }
  | {
      currentVersion: number;
      gameId: string;
      previousVersion: number;
      status: 'reconnected';
      view: GameView;
    }
  | { status: 'gameNotFound' };

export type DisconnectFromGameResult =
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

export type GameUpdateListener = (update: GameUpdate) => Promise<void> | void;

export interface EmptyWaitingGameExpirationInput {
  expiresAt: string;
  gameId: string;
  retryAttempt: number;
}

export interface ReconnectDeadlineInput {
  gameId: string;
  playerId: string;
  reconnectDeadline: string;
  retryAttempt: number;
}

export interface CreateGameServiceOptions {
  activeGames: ActiveGames;
  disconnectedPlayerTimeoutMs: number;
  emptyWaitingGameTimeoutMs: number;
  featureFlagsService: FeatureFlagsService;
  gameRepository: GameRepository;
}

export interface ListLobbyGamesInput {
  userId: string;
}

export interface ProjectionChanges {
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
        operation: 'removePlayer';
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
  recoverGames(this: void): Promise<void>;
  subscribe(this: void, listener: GameUpdateListener): () => void;
  synchronize(
    this: void,
    input: SynchronizeGameInput
  ): Promise<SynchronizeGameResult>;
}
