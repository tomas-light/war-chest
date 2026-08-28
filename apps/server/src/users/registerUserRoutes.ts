import type { ApiErrorCode } from '@war-chest/api-contracts';
import type { StoredAvatar } from '@war-chest/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { PublicUser } from './PublicUser.js';
import type { UserGameCursor, UserGamePage } from './UserRepository.js';

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
  const { auth, userRepository } = app.serverDependencies;
  const protectedRoute = { preHandler: app.requireAuthSession };

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

    const avatar = await auth.getAvatar(userId);

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

  async function getFinishedGames(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | SerializedUserGamePage> {
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

interface SerializedUserGamePage {
  items: Array<{
    finishedAt: string;
    id: string;
    participants: UserGamePage['items'][number]['participants'];
    result: UserGamePage['items'][number]['result'];
    team: UserGamePage['items'][number]['team'];
    winnerTeam: UserGamePage['items'][number]['winnerTeam'];
  }>;
  nextCursor: string | null;
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

function serializeGamePage(page: UserGamePage): SerializedUserGamePage {
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
  return reply
    .header('Cache-Control', 'private, max-age=31536000, immutable')
    .header('Content-Type', avatar.contentType)
    .send(avatar.content);
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
