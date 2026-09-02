import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import { sendGameNotFound } from './gameRouteResponses.js';

export function registerGetGameRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.get('/games/:gameId', { preHandler: app.requireAuthSession }, getGame);

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
      ? reply.send({ gameId, players: result.players, view: result.view })
      : sendGameNotFound(reply);
  }
}
