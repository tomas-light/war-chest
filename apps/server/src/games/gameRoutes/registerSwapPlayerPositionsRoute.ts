import { swapPlayerPositionsRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendInvalidGameRequest,
  sendMutationResult,
} from './gameRouteResponses.js';

export function registerSwapPlayerPositionsRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.post(
    '/games/:gameId/swap-positions',
    { preHandler: app.requireAuthSession },
    swapPlayerPositions
  );

  async function swapPlayerPositions(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const body = swapPlayerPositionsRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
    }

    const userId = getAuthenticatedUserId(request);
    const result = await gameService.executeCommand({
      command: { type: 'SwapPlayerPositions' },
      commandId: body.data.commandId,
      expectedVersion: body.data.expectedVersion,
      gameId,
      userId,
    });

    return sendMutationResult({ gameId, gameService, reply, result, userId });
  }
}
