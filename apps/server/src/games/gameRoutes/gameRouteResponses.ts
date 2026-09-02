import type { ApiErrorCode } from '@war-chest/api-contracts';
import type { FastifyReply } from 'fastify';
import type { ExecuteGameCommandResult, GameService } from '../GameService.js';

interface SendMutationResultInput {
  gameId: string;
  gameService: GameService;
  reply: FastifyReply;
  result: ExecuteGameCommandResult;
  userId: string;
}

interface SendErrorInput {
  code: ApiErrorCode;
  message: string;
  reply: FastifyReply;
  statusCode: number;
}

export async function sendMutationResult(
  input: SendMutationResultInput
): Promise<FastifyReply> {
  if (
    input.result.status === 'saved' ||
    input.result.status === 'alreadyJoined'
  ) {
    const snapshot = await input.gameService.getSnapshot({
      gameId: input.gameId,
      userId: input.userId,
    });

    return snapshot.status === 'found'
      ? input.reply.send({
          gameId: input.gameId,
          players: snapshot.players,
          view: input.result.view,
        })
      : sendGameNotFound(input.reply);
  }

  if (input.result.status === 'gameDeleted') {
    return input.reply.send({ gameId: input.gameId });
  }

  if (input.result.status === 'duplicateCommand') {
    const snapshot = await input.gameService.getSnapshot({
      gameId: input.gameId,
      userId: input.userId,
    });

    return snapshot.status === 'found'
      ? input.reply.send({
          gameId: input.gameId,
          players: snapshot.players,
          view: snapshot.view,
        })
      : sendGameNotFound(input.reply);
  }

  if (input.result.status === 'gameNotFound') {
    return sendGameNotFound(input.reply);
  }

  if (input.result.status === 'gameCommandForbidden') {
    return sendError({
      code: 'game_command_forbidden',
      message: 'The authenticated user cannot perform this game command.',
      reply: input.reply,
      statusCode: 403,
    });
  }

  if (input.result.status === 'gamePositionOccupied') {
    return sendError({
      code: 'game_position_occupied',
      message: 'The requested game position is occupied.',
      reply: input.reply,
      statusCode: 409,
    });
  }

  if (input.result.status === 'playerAlreadyInGame') {
    return sendPlayerAlreadyInGame(input.reply);
  }

  if (input.result.status === 'versionConflict') {
    return sendError({
      code: 'game_version_conflict',
      message: 'The game has changed since the requested version.',
      reply: input.reply,
      statusCode: 409,
    });
  }

  if (input.result.status === 'commandIdConflict') {
    return sendCommandIdConflict(input.reply);
  }

  return sendError({
    code: 'game_command_rejected',
    message: 'The game command was rejected.',
    reply: input.reply,
    statusCode: 422,
  });
}

export function sendInvalidGameRequest(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'invalid_request',
    message: 'Game request is invalid.',
    reply,
    statusCode: 400,
  });
}

export function sendGameNotFound(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'game_not_found',
    message: 'Game was not found.',
    reply,
    statusCode: 404,
  });
}

export function sendCommandIdConflict(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'command_id_conflict',
    message: 'Command id was already used by another request.',
    reply,
    statusCode: 409,
  });
}

export function sendPlayerAlreadyInGame(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'player_already_in_game',
    message: 'The authenticated user is already playing another game.',
    reply,
    statusCode: 409,
  });
}

function sendError(input: SendErrorInput): FastifyReply {
  return input.reply
    .code(input.statusCode)
    .send({ error: { code: input.code, message: input.message } });
}
