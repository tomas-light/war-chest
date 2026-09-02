import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PublicUser } from '../PublicUser.js';
import { parseUserId } from './userRouteRequest.js';
import { sendUserNotFound } from './userRouteResponses.js';

export function registerGetPublicUserRoute(app: FastifyInstance): void {
  const { userRepository } = app.serverDependencies;

  app.get(
    '/users/:userId',
    { preHandler: app.requireAuthSession },
    getPublicUser
  );

  async function getPublicUser(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    const userId = parseUserId(request, reply);

    if (userId === null) {
      return reply;
    }

    const user = await userRepository.findPublicUser(userId);

    return user ?? sendUserNotFound(reply);
  }
}
