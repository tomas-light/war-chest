import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PublicUser } from '../PublicUser.js';
import { requireCurrentUserId } from './userRouteRequest.js';
import { sendUserNotFound } from './userRouteResponses.js';

export function registerRemoveCurrentUserAvatarRoute(
  app: FastifyInstance
): void {
  const { userRepository } = app.serverDependencies;

  app.delete(
    '/users/me/avatar',
    { preHandler: app.requireAuthSession },
    removeCurrentUserAvatar
  );

  async function removeCurrentUserAvatar(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    const user = await userRepository.removeAvatar(
      requireCurrentUserId(request)
    );

    return user ?? sendUserNotFound(reply);
  }
}
