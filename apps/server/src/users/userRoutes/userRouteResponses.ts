import { type ApiErrorCode, AVATAR_PRESETS } from '@war-chest/api-contracts';
import type { FastifyReply } from 'fastify';
import type { StoredAvatar } from '../UserRepository.js';

interface SendErrorInput {
  code: ApiErrorCode;
  message: string;
  reply: FastifyReply;
  statusCode: number;
}

export function sendAvatar(
  reply: FastifyReply,
  avatar: StoredAvatar
): FastifyReply {
  if (avatar.kind === 'preset') {
    const preset = AVATAR_PRESETS.find((item) => item.id === avatar.presetId);

    if (preset === undefined) {
      return sendUserNotFound(reply);
    }

    return reply.code(302).header('Location', preset.imageUrl).send();
  }

  return reply
    .header('Cache-Control', 'private, max-age=31536000, immutable')
    .header('Content-Type', avatar.contentType)
    .send(avatar.content);
}

export function sendUserNotFound(reply: FastifyReply): FastifyReply {
  return sendUserRouteError({
    code: 'user_not_found',
    message: 'User was not found.',
    reply,
    statusCode: 404,
  });
}

export function sendUserRouteError(input: SendErrorInput): FastifyReply {
  return input.reply
    .code(input.statusCode)
    .send({ error: { code: input.code, message: input.message } });
}
