import { gameParamsSchema } from '@war-chest/api-contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendInvalidGameRequest } from './gameRouteResponses.js';

export function parseGameId(
  request: FastifyRequest,
  reply: FastifyReply
): string | null {
  const result = gameParamsSchema.safeParse(request.params);

  if (!result.success) {
    sendInvalidGameRequest(reply);
    return null;
  }

  return result.data.gameId;
}

export function getAuthenticatedUserId(request: FastifyRequest): string {
  const userId = request.authSession?.user.id;

  if (userId === undefined) {
    throw new Error('Authenticated game route has no session.');
  }

  return userId;
}
