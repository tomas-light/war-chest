import type { Game, GameParticipant } from '@war-chest/database';
import type {
  GameCreatedEventData,
  GameEventData,
} from '@war-chest/game-engine';

export type GameTeam = NonNullable<GameParticipant['team']>;

export interface StoredGame {
  createdAt: Date;
  currentVersion: number;
  finishedAt: Date | null;
  id: string;
  startedAt: Date | null;
  status: Game['status'];
  winnerTeam: Game['winnerTeam'];
}

export interface StoredParticipant {
  gameId: string;
  seat: number;
  team: GameParticipant['team'];
  userId: string;
}

export interface StoredGamePlayer {
  avatarVersion: string | null;
  displayName: string;
  id: string;
  seat: number;
  team: GameTeam;
}

export interface StoredLobbyGame {
  createdAt: Date;
  id: string;
  players: readonly StoredGamePlayer[];
  startedAt: Date | null;
  status: 'active' | 'waiting';
}

export interface ProcessedCommandIdentity {
  commandType: string;
  gameId: string;
  requestHash: string;
  userId: string;
}

export interface GameProjectionChanges {
  finishedAt?: Date | null;
  startedAt?: Date | null;
  status?: Game['status'];
  winnerTeam?: Game['winnerTeam'];
}

export type ParticipantProjectionChange =
  | {
      operation: 'addPlayer';
      seat: number;
      team: GameTeam;
      userId: string;
    }
  | {
      operation: 'movePlayer';
      seat: number;
      team: GameTeam;
      userId: string;
    }
  | {
      operation: 'removePlayer';
      userId: string;
    }
  | {
      operation: 'swapPlayers';
      positions: [
        { seat: number; team: GameTeam; userId: string },
        { seat: number; team: GameTeam; userId: string },
      ];
    };

export interface CreateStoredGameInput {
  commandId: string;
  creatorUserId: string;
  event: GameCreatedEventData;
  requestHash: string;
}

export type CreateStoredGameResult =
  | { createdAt: Date; gameId: string; status: 'created' }
  | { gameId: string; status: 'duplicateCommand' }
  | { status: 'commandIdConflict' };

export interface DeleteExpiredWaitingGameInput {
  expiredBefore: Date;
  gameId: string;
}

export interface DeleteWaitingGameInput {
  expectedVersion: number;
  gameId: string;
}

export type DeleteWaitingGameResult =
  | { status: 'deleted' }
  | { status: 'notFound' }
  | { status: 'notWaiting' }
  | { currentVersion: number; status: 'versionConflict' };

export type DeleteExpiredWaitingGameResult =
  | { status: 'deleted' }
  | { status: 'notEmpty' }
  | { createdAt: Date; status: 'notExpired' }
  | { status: 'notFound' }
  | { status: 'notWaiting' };

export interface StoredEmptyWaitingGame {
  createdAt: Date;
  id: string;
}

export interface SaveGameCommandInput {
  commandId: string;
  commandType: string;
  events: readonly GameEventData[];
  expectedVersion: number;
  gameChanges?: GameProjectionChanges;
  gameId: string;
  participantChanges?: readonly ParticipantProjectionChange[];
  requestHash: string;
  userId: string;
}

export type SaveGameCommandResult =
  | { currentVersion: number; status: 'saved' }
  | { currentVersion: number; status: 'duplicateCommand' }
  | { currentVersion: number; status: 'versionConflict' }
  | { status: 'commandIdConflict' }
  | { status: 'playerAlreadyInGame' };

export interface SaveSystemEventsInput {
  events: readonly GameEventData[];
  expectedVersion: number;
  gameChanges?: GameProjectionChanges;
  gameId: string;
}

export type SaveSystemEventsResult =
  | { currentVersion: number; status: 'saved' }
  | { currentVersion: number; status: 'versionConflict' };

export interface GameRepository {
  createGame(
    this: void,
    input: CreateStoredGameInput
  ): Promise<CreateStoredGameResult>;
  deleteExpiredWaitingGame(
    this: void,
    input: DeleteExpiredWaitingGameInput
  ): Promise<DeleteExpiredWaitingGameResult>;
  deleteWaitingGame(
    this: void,
    input: DeleteWaitingGameInput
  ): Promise<DeleteWaitingGameResult>;
  findGame(this: void, gameId: string): Promise<StoredGame | null>;
  listGamePlayers(
    this: void,
    gameId: string
  ): Promise<readonly StoredGamePlayer[]>;
  findCurrentPlayerGame(this: void, userId: string): Promise<string | null>;
  findActiveGameIds(this: void): Promise<readonly string[]>;
  listEmptyWaitingGames(this: void): Promise<readonly StoredEmptyWaitingGame[]>;
  listLobbyGames(this: void): Promise<readonly StoredLobbyGame[]>;
  findParticipant(
    this: void,
    gameId: string,
    userId: string
  ): Promise<StoredParticipant | null>;
  findProcessedCommand(
    this: void,
    commandId: string
  ): Promise<ProcessedCommandIdentity | null>;
  loadEvents(
    this: void,
    gameId: string,
    afterSequence?: number
  ): Promise<readonly GameEventData[]>;
  saveCommand(
    this: void,
    input: SaveGameCommandInput
  ): Promise<SaveGameCommandResult>;
  saveSystemEvents(
    this: void,
    input: SaveSystemEventsInput
  ): Promise<SaveSystemEventsResult>;
}
