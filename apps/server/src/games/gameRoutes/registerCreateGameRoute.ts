import { createGameRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId } from './gameRouteRequest.js';
import {
  sendCommandIdConflict,
  sendGameNotFound,
  sendInvalidGameRequest,
  sendPlayerAlreadyInGame,
} from './gameRouteResponses.js';

export function registerCreateGameRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.post('/games', { preHandler: app.requireAuthSession }, createGame);

  async function createGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = createGameRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendInvalidGameRequest(reply);
    }

    const result = await gameService.createGame({
      commandId: body.data.commandId,
      userId: getAuthenticatedUserId(request),
    });

    if (result.status === 'featureFlagsUnavailable') {
      return reply.code(503).send({
        error: {
          code: 'feature_flags_unavailable',
          message: 'Feature flags are temporarily unavailable.',
        },
      });
    }

    if (result.status === 'commandIdConflict') {
      return sendCommandIdConflict(reply);
    }

    if (result.status === 'playerAlreadyInGame') {
      return sendPlayerAlreadyInGame(reply);
    }

    if (result.status === 'created') {
      return reply
        .code(201)
        .send({ gameId: result.gameId, players: [], view: result.view });
    }

    const snapshot = await gameService.getSnapshot({
      gameId: result.gameId,
      userId: getAuthenticatedUserId(request),
    });

    return snapshot.status === 'found'
      ? reply.send({
          gameId: result.gameId,
          players: snapshot.players,
          view: result.view,
        })
      : sendGameNotFound(reply);
  }
}
