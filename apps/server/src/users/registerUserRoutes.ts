import {
  type ApiErrorCode,
  type UserGamesResponse,
  AVATAR_PRESETS,
  selectAvatarPresetRequestSchema,
  updateCurrentUserRequestSchema,
} from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { normalizeAvatar } from './normalizeAvatar.js';
import type { PublicUser } from './PublicUser.js';
import type {
  StoredAvatar,
  UserGameCursor,
  UserGamePage,
} from './UserRepository.js';

const DEFAULT_HISTORY_LIMIT = 20;
const MAXIMUM_HISTORY_LIMIT = 100;

interface SendErrorInput {
  code: ApiErrorCode;
  message: string;
  reply: FastifyReply;
  statusCode: number;
}

const userParamsSchema = z.object({ userId: z.uuid() }).strict();
const userGameQuerySchema = z
  .object({
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAXIMUM_HISTORY_LIMIT)
      .default(DEFAULT_HISTORY_LIMIT),
  })
  .strict();
const userGameCursorSchema = z
  .object({
    finishedAt: z.iso.datetime(),
    gameId: z.uuid(),
  })
  .strict();

export function registerUserRoutes(app: FastifyInstance): void {
  const { userRepository } = app.serverDependencies;
  const protectedRoute = { preHandler: app.requireAuthSession };

  app.patch('/users/me', protectedRoute, updateCurrentUser);
  app.put('/users/me/avatar', protectedRoute, uploadCurrentUserAvatar);
  app.put('/users/me/avatar/preset', protectedRoute, selectCurrentUserAvatar);
  app.delete('/users/me/avatar', protectedRoute, removeCurrentUserAvatar);
  app.get('/users/:userId', protectedRoute, getPublicUser);
  app.get('/users/:userId/avatar', protectedRoute, getAvatar);
  app.get('/users/:userId/games', protectedRoute, getFinishedGames);

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
      return sendError({
        code: 'avatar_not_found',
        message: 'Avatar was not found.',
        reply,
        statusCode: 404,
      });
    }

    return sendAvatar(reply, avatar);
  }

  async function updateCurrentUser(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    const body = updateCurrentUserRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendError({
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

  async function selectCurrentUserAvatar(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    const body = selectAvatarPresetRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendError({
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

  async function uploadCurrentUserAvatar(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    if (!Buffer.isBuffer(request.body)) {
      return sendError({
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
      return sendError({
        code: 'avatar_invalid',
        message: 'Avatar must be a JPEG, PNG, or WebP image up to 4096x4096.',
        reply,
        statusCode: 400,
      });
    }
  }

  async function removeCurrentUserAvatar(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | PublicUser> {
    const user = await userRepository.removeAvatar(
      requireCurrentUserId(request)
    );
    return user ?? sendUserNotFound(reply);
  }

  async function getFinishedGames(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | UserGamesResponse> {
    const userId = parseUserId(request, reply);

    if (userId === null) {
      return reply;
    }

    const queryResult = userGameQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return sendError({
        code: 'invalid_request',
        message: 'History pagination parameters are invalid.',
        reply,
        statusCode: 400,
      });
    }

    const cursor = parseCursor(queryResult.data.cursor, reply);

    if (cursor === null && queryResult.data.cursor !== undefined) {
      return reply;
    }

    if ((await userRepository.findPublicUser(userId)) === null) {
      return sendUserNotFound(reply);
    }

    const page = await userRepository.listFinishedGames(userId, {
      cursor: cursor ?? undefined,
      limit: queryResult.data.limit,
    });

    return serializeGamePage(page);
  }
}

function parseUserId(
  request: FastifyRequest,
  reply: FastifyReply
): string | null {
  const result = userParamsSchema.safeParse(request.params);

  if (!result.success) {
    sendError({
      code: 'invalid_request',
      message: 'User id must be a valid UUID.',
      reply,
      statusCode: 400,
    });
    return null;
  }

  return result.data.userId;
}

function parseCursor(
  encodedCursor: string | undefined,
  reply: FastifyReply
): UserGameCursor | null {
  if (encodedCursor === undefined) {
    return null;
  }

  try {
    const cursorJson: unknown = JSON.parse(
      Buffer.from(encodedCursor, 'base64url').toString('utf8')
    );
    const cursor = userGameCursorSchema.parse(cursorJson);

    return {
      finishedAt: new Date(cursor.finishedAt),
      gameId: cursor.gameId,
    };
  } catch {
    sendError({
      code: 'invalid_cursor',
      message: 'History cursor is invalid.',
      reply,
      statusCode: 400,
    });
    return null;
  }
}

function serializeGamePage(page: UserGamePage): UserGamesResponse {
  return {
    items: page.items.map((game) => ({
      ...game,
      finishedAt: game.finishedAt.toISOString(),
    })),
    nextCursor: page.nextCursor === null ? null : encodeCursor(page.nextCursor),
  };
}

function encodeCursor(cursor: UserGameCursor): string {
  return Buffer.from(
    JSON.stringify({
      finishedAt: cursor.finishedAt.toISOString(),
      gameId: cursor.gameId,
    })
  ).toString('base64url');
}

function sendAvatar(reply: FastifyReply, avatar: StoredAvatar): FastifyReply {
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

function requireCurrentUserId(request: FastifyRequest): string {
  if (request.authSession === null) {
    throw new Error('Auth session pre-handler did not resolve a session.');
  }

  return request.authSession.user.id;
}

function sendUserNotFound(reply: FastifyReply): FastifyReply {
  return sendError({
    code: 'user_not_found',
    message: 'User was not found.',
    reply,
    statusCode: 404,
  });
}

function sendError(input: SendErrorInput): FastifyReply {
  return input.reply
    .code(input.statusCode)
    .send({ error: { code: input.code, message: input.message } });
}
