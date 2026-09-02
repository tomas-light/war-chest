import type { UserGamesResponse } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { UserGameCursor, UserGamePage } from '../UserRepository.js';
import { parseUserId } from './userRouteRequest.js';
import { sendUserNotFound, sendUserRouteError } from './userRouteResponses.js';

const DEFAULT_HISTORY_LIMIT = 20;
const MAXIMUM_HISTORY_LIMIT = 100;
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

export function registerGetFinishedGamesRoute(app: FastifyInstance): void {
  const { userRepository } = app.serverDependencies;

  app.get(
    '/users/:userId/games',
    { preHandler: app.requireAuthSession },
    getFinishedGames
  );

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
      return sendUserRouteError({
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
    sendUserRouteError({
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
