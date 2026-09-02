import { updateCurrentUserRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PublicUser } from '../PublicUser.js';
import { requireCurrentUserId } from './userRouteRequest.js';
import { sendUserNotFound, sendUserRouteError } from './userRouteResponses.js';

export function registerUpdateCurrentUserRoute(app: FastifyInstance): void {
  const { userRepository } = app.serverDependencies;

  app.patch(
    '/users/me',
    { preHandler: app.requireAuthSession },
    updateCurrentUser
  );

  async function updateCurrentUser(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    const body = updateCurrentUserRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendUserRouteError({
        code: 'invalid_request',
        message: 'Nickname must contain 2 to 24 supported characters.',
        reply,
        statusCode: 400,
      });
    }

    const user = await userRepository.updateDisplayName(
      requireCurrentUserId(request),
      body.data.displayName
    );

    return user ?? sendUserNotFound(reply);
  }
}
