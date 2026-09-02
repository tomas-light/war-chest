import type { ExecuteGameCommandResult } from '../GameService.js';
import { emitGameError, emitSynchronization } from './gameSocketOperations.js';
import type { GameSocketContext } from './GameSocketTypes.js';

export function handleCommandResult(
  context: GameSocketContext,
  gameId: string,
  result: ExecuteGameCommandResult
): void {
  if (result.status === 'saved') {
    if (!context.joinedGameIds.has(gameId)) {
      context.socket.emit('game:events', { events: result.events, gameId });
    }

    return;
  }

  if (result.status === 'duplicateCommand') {
    emitSynchronization(context.socket, gameId, result.synchronization);
    return;
  }

  if (result.status === 'alreadyJoined') {
    context.socket.emit('game:snapshot', { gameId, view: result.view });
    return;
  }

  if (result.status === 'gameDeleted') {
    return;
  }

  if (result.status === 'versionConflict') {
    context.socket.emit('game:error', {
      code: 'game_version_conflict',
      currentVersion: result.currentVersion,
      gameId,
      message: 'The game has changed since the requested version.',
    });
    return;
  }

  const errors = {
    commandIdConflict: {
      code: 'command_id_conflict',
      message: 'Command id was already used by another request.',
    },
    commandRejected: {
      code: 'game_command_rejected',
      message: 'The game command was rejected.',
    },
    gameCommandForbidden: {
      code: 'game_command_forbidden',
      message: 'The authenticated user cannot perform this game command.',
    },
    gameNotFound: {
      code: 'game_not_found',
      message: 'Game was not found.',
    },
    gamePositionOccupied: {
      code: 'game_position_occupied',
      message: 'The requested game position is occupied.',
    },
    playerAlreadyInGame: {
      code: 'player_already_in_game',
      message: 'The authenticated user is already playing another game.',
    },
  } as const;
  const error = errors[result.status];

  emitGameError({
    code: error.code,
    gameId,
    message: error.message,
    socket: context.socket,
  });
}
