import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { sendUserRouteError } from './userRouteResponses.js';

const userParamsSchema = z.object({ userId: z.uuid() }).strict();

export function parseUserId(
  request: FastifyRequest,
  reply: FastifyReply
): string | null {
  const result = userParamsSchema.safeParse(request.params);

  if (!result.success) {
    sendUserRouteError({
      code: 'invalid_request',
      message: 'User id must be a valid UUID.',
      reply,
      statusCode: 400,
    });
    return null;
  }

  return result.data.userId;
}

export function requireCurrentUserId(request: FastifyRequest): string {
  if (request.authSession === null) {
    throw new Error('Auth session pre-handler did not resolve a session.');
  }

  return request.authSession.user.id;
}
