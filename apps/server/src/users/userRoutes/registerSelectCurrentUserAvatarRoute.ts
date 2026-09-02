import { selectAvatarPresetRequestSchema } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { PublicUser } from '../PublicUser.js';
import { requireCurrentUserId } from './userRouteRequest.js';
import { sendUserNotFound, sendUserRouteError } from './userRouteResponses.js';

export function registerSelectCurrentUserAvatarRoute(
  app: FastifyInstance
): void {
  const { userRepository } = app.serverDependencies;

  app.put(
    '/users/me/avatar/preset',
    { preHandler: app.requireAuthSession },
    selectCurrentUserAvatar
  );

  async function selectCurrentUserAvatar(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    const body = selectAvatarPresetRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendUserRouteError({
        code: 'invalid_request',
        message: 'Avatar preset is invalid.',
        reply,
        statusCode: 400,
      });
    }

    const user = await userRepository.selectAvatarPreset(
      requireCurrentUserId(request),
      body.data.presetId
    );

    return user ?? sendUserNotFound(reply);
  }
}
