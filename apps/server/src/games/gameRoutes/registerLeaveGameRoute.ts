import { leaveGameRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendInvalidGameRequest,
  sendMutationResult,
} from './gameRouteResponses.js';

export function registerLeaveGameRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.post(
    '/games/:gameId/leave',
    { preHandler: app.requireAuthSession },
    leaveGame
  );

  async function leaveGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const body = leaveGameRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
    }

    const userId = getAuthenticatedUserId(request);
    const result = await gameService.executeCommand({
      command: { type: 'LeaveGame' },
      commandId: body.data.commandId,
      expectedVersion: body.data.expectedVersion,
      gameId,
      userId,
    });

    if (
      result.status === 'saved' ||
      result.status === 'duplicateCommand' ||
      result.status === 'gameDeleted'
    ) {
      return reply.send({ gameId });
    }

    return sendMutationResult({ gameId, gameService, reply, result, userId });
  }
}
