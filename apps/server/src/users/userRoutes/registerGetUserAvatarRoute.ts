import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { parseUserId } from './userRouteRequest.js';
import { sendAvatar, sendUserRouteError } from './userRouteResponses.js';

export function registerGetUserAvatarRoute(app: FastifyInstance): void {
  const { userRepository } = app.serverDependencies;

  app.get(
    '/users/:userId/avatar',
    { preHandler: app.requireAuthSession },
    getAvatar
  );

  async function getAvatar(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const userId = parseUserId(request, reply);

    if (userId === null) {
      return reply;
    }

    const avatar = await userRepository.findAvatar(userId);

    if (avatar === null) {
      return sendUserRouteError({
        code: 'avatar_not_found',
        message: 'Avatar was not found.',
        reply,
        statusCode: 404,
      });
    }

    return sendAvatar(reply, avatar);
  }
}
