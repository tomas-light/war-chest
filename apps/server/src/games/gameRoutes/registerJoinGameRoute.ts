import { joinGameRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendInvalidGameRequest,
  sendMutationResult,
} from './gameRouteResponses.js';

export function registerJoinGameRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.post(
    '/games/:gameId/join',
    { preHandler: app.requireAuthSession },
    joinGame
  );

  async function joinGame(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const body = joinGameRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
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
}
