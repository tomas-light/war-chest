import { gameEventsQuerySchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendGameNotFound,
  sendInvalidGameRequest,
} from './gameRouteResponses.js';

export function registerGetGameEventsRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.get(
    '/games/:gameId/events',
    { preHandler: app.requireAuthSession },
    getGameEvents
  );

  async function getGameEvents(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const query = gameEventsQuerySchema.safeParse(request.query);

    if (gameId === null || !query.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
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
