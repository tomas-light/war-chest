import { updateGameSettingsRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendInvalidGameRequest,
  sendMutationResult,
} from './gameRouteResponses.js';

export function registerUpdateGameSettingsRoute(app: FastifyInstance): void {
  const { gameService } = app.serverDependencies;

  app.post(
    '/games/:gameId/settings',
    { preHandler: app.requireAuthSession },
    updateGameSettings
  );

  async function updateGameSettings(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const gameId = parseGameId(request, reply);
    const body = updateGameSettingsRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
    }

    const userId = getAuthenticatedUserId(request);
    const result = await gameService.executeCommand({
      command: {
        cardSelectionMode: body.data.cardSelectionMode,
        expansions: body.data.expansions,
        type: 'UpdateGameSettings',
      },
      commandId: body.data.commandId,
      expectedVersion: body.data.expectedVersion,
      gameId,
      userId,
    });

    return sendMutationResult({ gameId, gameService, reply, result, userId });
  }
}
