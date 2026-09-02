import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { normalizeAvatar } from '../normalizeAvatar.js';
import type { PublicUser } from '../PublicUser.js';
import { requireCurrentUserId } from './userRouteRequest.js';
import { sendUserNotFound, sendUserRouteError } from './userRouteResponses.js';

export function registerUploadCurrentUserAvatarRoute(
  app: FastifyInstance
): void {
  const { userRepository } = app.serverDependencies;

  app.put(
    '/users/me/avatar',
    { preHandler: app.requireAuthSession },
    uploadCurrentUserAvatar
  );

  async function uploadCurrentUserAvatar(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    if (!Buffer.isBuffer(request.body)) {
      return sendUserRouteError({
        code: 'avatar_invalid',
        message: 'Avatar must be a JPEG, PNG, or WebP image.',
        reply,
        statusCode: 400,
      });
    }

    try {
      const avatar = await normalizeAvatar(request.body);
      const user = await userRepository.saveAvatar(
        requireCurrentUserId(request),
        avatar
      );

      return user ?? sendUserNotFound(reply);
    } catch {
      return sendUserRouteError({
        code: 'avatar_invalid',
        message: 'Avatar must be a JPEG, PNG, or WebP image up to 4096x4096.',
        reply,
        statusCode: 400,
      });
    }
  }
}
