import { startGameRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendInvalidGameRequest,
  sendMutationResult,
} from './gameRouteResponses.js';

export function registerStartGameRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.post(
    '/games/:gameId/start',
    { preHandler: app.requireAuthSession },
    startGame
  );

  async function startGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const body = startGameRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
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
}
