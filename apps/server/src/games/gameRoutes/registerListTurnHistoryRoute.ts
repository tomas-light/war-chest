import { gameTurnHistoryQuerySchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendGameNotFound,
  sendInvalidGameRequest,
} from './gameRouteResponses.js';

export function registerListTurnHistoryRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.get(
    '/games/:gameId/turn-history',
    { preHandler: app.requireAuthSession },
    listTurnHistory
  );

  async function listTurnHistory(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const query = gameTurnHistoryQuerySchema.safeParse(request.query);

    if (gameId === null || !query.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
    }

    const result = await gameService.getEvents({
      afterSequence: 0,
      gameId,
      userId: getAuthenticatedUserId(request),
    });

    if (result.status !== 'found') {
      return sendGameNotFound(reply);
    }

    const history = result.events.flatMap((event) => {
      if (
        (event.type !== 'TurnPassed' && event.type !== 'TurnActionPerformed') ||
        (query.data.beforeSequence !== undefined &&
          event.sequence >= query.data.beforeSequence)
      ) {
        return [];
      }

      return [event];
    });
    history.reverse();
    const hasNextPage = history.length > query.data.limit;
    const page = history.slice(0, query.data.limit);
    const lastItem = page.at(-1);

    return reply.send({
      items: page.map((event) => ({
        action:
          event.type === 'TurnPassed'
            ? ('pass' as const)
            : event.payload.action.type,
        playerId: event.payload.playerId,
        sequence: event.sequence,
      })),
      nextCursor:
        hasNextPage && lastItem !== undefined ? lastItem.sequence : null,
    });
  }
}
