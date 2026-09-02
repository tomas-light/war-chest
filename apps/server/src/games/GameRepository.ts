import type { Database } from '@war-chest/database';
import type { GameEventData } from '@war-chest/game-engine';
import { createGame as createStoredGame } from './gameRepository/createGame.js';
import { deleteExpiredWaitingGame as deleteExpiredStoredWaitingGame } from './gameRepository/deleteExpiredWaitingGame.js';
import { deleteWaitingGame as deleteStoredWaitingGame } from './gameRepository/deleteWaitingGame.js';
import { findActiveGameIds as findStoredActiveGameIds } from './gameRepository/findActiveGameIds.js';
import { findCurrentPlayerGame as findStoredCurrentPlayerGame } from './gameRepository/findCurrentPlayerGame.js';
import { findGame as findStoredGame } from './gameRepository/findGame.js';
import { findParticipant as findStoredParticipant } from './gameRepository/findParticipant.js';
import { findProcessedCommand as findStoredProcessedCommand } from './gameRepository/findProcessedCommand.js';
import type {
  CreateStoredGameInput,
  CreateStoredGameResult,
  DeleteExpiredWaitingGameInput,
  DeleteExpiredWaitingGameResult,
  DeleteWaitingGameInput,
  DeleteWaitingGameResult,
  GameRepository,
  ProcessedCommandIdentity,
  SaveGameCommandInput,
  SaveGameCommandResult,
  SaveSystemEventsInput,
  SaveSystemEventsResult,
  StoredEmptyWaitingGame,
  StoredGame,
  StoredGamePlayer,
  StoredLobbyGame,
  StoredParticipant,
} from './gameRepository/GameRepositoryTypes.js';
import { listEmptyWaitingGames as listStoredEmptyWaitingGames } from './gameRepository/listEmptyWaitingGames.js';
import { listGamePlayers as listStoredGamePlayers } from './gameRepository/listGamePlayers.js';
import { listLobbyGames as listStoredLobbyGames } from './gameRepository/listLobbyGames.js';
import { loadEvents as loadStoredEvents } from './gameRepository/loadEvents.js';
import { saveCommand as saveStoredCommand } from './gameRepository/saveCommand.js';
import { saveSystemEvents as saveStoredSystemEvents } from './gameRepository/saveSystemEvents.js';

export type {
  GameRepository,
  StoredGamePlayer,
  StoredLobbyGame,
  StoredParticipant,
} from './gameRepository/GameRepositoryTypes.js';

export function createGameRepository(database: Database): GameRepository {
  return {
    createGame,
    deleteExpiredWaitingGame,
    deleteWaitingGame,
    findActiveGameIds,
    findCurrentPlayerGame,
    findGame,
    findParticipant,
    findProcessedCommand,
    listEmptyWaitingGames,
    listGamePlayers,
    listLobbyGames,
    loadEvents,
    saveCommand,
    saveSystemEvents,
  };

  function createGame(
    input: CreateStoredGameInput
  ): Promise<CreateStoredGameResult> {
    return createStoredGame({
      database,
      findProcessedCommand,
      game: input,
    });
  }

  function deleteExpiredWaitingGame(
    input: DeleteExpiredWaitingGameInput
  ): Promise<DeleteExpiredWaitingGameResult> {
    return deleteExpiredStoredWaitingGame(database, input);
  }

  function deleteWaitingGame(
    input: DeleteWaitingGameInput
  ): Promise<DeleteWaitingGameResult> {
    return deleteStoredWaitingGame(database, input);
  }

  function findActiveGameIds(): Promise<readonly string[]> {
    return findStoredActiveGameIds(database);
  }

  function findCurrentPlayerGame(userId: string): Promise<string | null> {
    return findStoredCurrentPlayerGame(database, userId);
  }

  function findGame(gameId: string): Promise<StoredGame | null> {
    return findStoredGame(database, gameId);
  }

  function findParticipant(
    gameId: string,
    userId: string
  ): Promise<StoredParticipant | null> {
    return findStoredParticipant(database, gameId, userId);
  }

  function findProcessedCommand(
    commandId: string
  ): Promise<ProcessedCommandIdentity | null> {
    return findStoredProcessedCommand(database, commandId);
  }

  function listEmptyWaitingGames(): Promise<readonly StoredEmptyWaitingGame[]> {
    return listStoredEmptyWaitingGames(database);
  }

  function listGamePlayers(
    gameId: string
  ): Promise<readonly StoredGamePlayer[]> {
    return listStoredGamePlayers(database, gameId);
  }

  function listLobbyGames(): Promise<readonly StoredLobbyGame[]> {
    return listStoredLobbyGames(database);
  }

  function loadEvents(
    gameId: string,
    afterSequence = 0
  ): Promise<readonly GameEventData[]> {
    return loadStoredEvents(database, gameId, afterSequence);
  }

  function saveCommand(
    input: SaveGameCommandInput
  ): Promise<SaveGameCommandResult> {
    return saveStoredCommand({
      database,
      findGame,
      findProcessedCommand,
      gameCommand: input,
    });
  }

  function saveSystemEvents(
    input: SaveSystemEventsInput
  ): Promise<SaveSystemEventsResult> {
    return saveStoredSystemEvents(database, input);
  }
}
