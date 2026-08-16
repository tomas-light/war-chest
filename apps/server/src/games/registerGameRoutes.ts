import {
  createGameRequestSchema,
  gameEventsQuerySchema,
  gameParamsSchema,
  joinGameRequestSchema,
  startGameRequestSchema,
} from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ExecuteGameCommandResult, GameService } from './GameService.js';

interface SendMutationResultInput {
  gameId: string;
  gameService: GameService;
  reply: FastifyReply;
  result: ExecuteGameCommandResult;
  userId: string;
}

interface SendErrorInput {
  code: string;
  message: string;
  reply: FastifyReply;
  statusCode: number;
}

export function registerGameRoutes(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;
  const protectedRoute = { preHandler: app.requireAuthSession };

  app.post('/games', protectedRoute, createGame);
  app.get('/games/:gameId', protectedRoute, getGame);
  app.post('/games/:gameId/join', protectedRoute, joinGame);
  app.post('/games/:gameId/start', protectedRoute, startGame);
  app.get('/games/:gameId/events', protectedRoute, getGameEvents);

  async function createGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = createGameRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendInvalidRequest(reply);
    }

    const result = await gameService.createGame({
      commandId: body.data.commandId,
      userId: getAuthenticatedUserId(request),
    });

    if (result.status === 'featureFlagsUnavailable') {
      return sendError({
        code: 'feature_flags_unavailable',
        message: 'Feature flags are temporarily unavailable.',
        reply,
        statusCode: 503,
      });
    }

    if (result.status === 'commandIdConflict') {
      return sendCommandIdConflict(reply);
    }

    return reply
      .code(result.status === 'created' ? 201 : 200)
      .send({ gameId: result.gameId, view: result.view });
  }

  async function getGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);

    if (gameId === null) {
      return reply;
    }

    const result = await gameService.getSnapshot({
      gameId,
      userId: getAuthenticatedUserId(request),
    });

    return result.status === 'found'
      ? reply.send({ gameId, view: result.view })
      : sendGameNotFound(reply);
  }

  async function joinGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const body = joinGameRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidRequest(reply);
    }

    const userId = getAuthenticatedUserId(request);
    const result = await gameService.executeCommand({
      command: {
        seat: body.data.seat,
        team: body.data.team,
        type: 'JoinGame',
      },
      commandId: body.data.commandId,
      expectedVersion: body.data.expectedVersion,
      gameId,
      userId,
    });

    return sendMutationResult({ gameId, gameService, reply, result, userId });
  }

  async function startGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const body = startGameRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidRequest(reply);
    }

    const userId = getAuthenticatedUserId(request);
    const result = await gameService.executeCommand({
      command: { type: 'StartGame' },
      commandId: body.data.commandId,
      expectedVersion: body.data.expectedVersion,
      gameId,
      userId,
    });

    return sendMutationResult({ gameId, gameService, reply, result, userId });
  }

  async function getGameEvents(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const query = gameEventsQuerySchema.safeParse(request.query);

    if (gameId === null || !query.success) {
      return gameId === null ? reply : sendInvalidRequest(reply);
    }

    const result = await gameService.getEvents({
      afterSequence: query.data.afterSequence,
      gameId,
      userId: getAuthenticatedUserId(request),
    });

    return result.status === 'found'
      ? reply.send({ events: result.events, gameId })
      : sendGameNotFound(reply);
  }
}

async function sendMutationResult(
  input: SendMutationResultInput
): Promise<FastifyReply> {
  if (
    input.result.status === 'saved' ||
    input.result.status === 'alreadyJoined'
  ) {
    return input.reply.send({ gameId: input.gameId, view: input.result.view });
  }

  if (input.result.status === 'duplicateCommand') {
    const snapshot = await input.gameService.getSnapshot({
      gameId: input.gameId,
      userId: input.userId,
    });

    return snapshot.status === 'found'
      ? input.reply.send({ gameId: input.gameId, view: snapshot.view })
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

function parseGameId(
  request: FastifyRequest,
  reply: FastifyReply
): string | null {
  const result = gameParamsSchema.safeParse(request.params);

  if (!result.success) {
    sendInvalidRequest(reply);
    return null;
  }

  return result.data.gameId;
}

function getAuthenticatedUserId(request: FastifyRequest): string {
  const userId = request.authSession?.user.id;

  if (userId === undefined) {
    throw new Error('Authenticated game route has no session.');
  }

  return userId;
}

function sendInvalidRequest(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'invalid_request',
    message: 'Game request is invalid.',
    reply,
    statusCode: 400,
  });
}

function sendGameNotFound(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'game_not_found',
    message: 'Game was not found.',
    reply,
    statusCode: 404,
  });
}

function sendCommandIdConflict(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'command_id_conflict',
    message: 'Command id was already used by another request.',
    reply,
    statusCode: 409,
  });
}

function sendError(input: SendErrorInput): FastifyReply {
  return input.reply
    .code(input.statusCode)
    .send({ error: { code: input.code, message: input.message } });
}
