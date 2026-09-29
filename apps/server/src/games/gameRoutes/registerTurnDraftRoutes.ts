import {
  cancelTurnDraftRequestSchema,
  confirmTurnDraftRequestSchema,
  saveTurnDraftRequestSchema,
} from '@war-chest/api-contracts';
import { gameTurnDrafts } from '@war-chest/database';
import { previewTurnAction } from '@war-chest/game-engine';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId, parseGameId } from './gameRouteRequest.js';
import {
  sendGameNotFound,
  sendInvalidGameRequest,
  sendMutationResult,
} from './gameRouteResponses.js';

export function registerTurnDraftRoutes(app: FastifyInstance): void {
  const { databaseConnection, gameService } = app.serverDependencies;
  const database = databaseConnection.database;
  const routeOptions = { preHandler: app.requireAuthSession };

  app.get('/games/:gameId/turn-draft', routeOptions, getDraft);
  app.post('/games/:gameId/turn-draft', routeOptions, saveDraft);
  app.post('/games/:gameId/turn-draft/cancel', routeOptions, cancelDraft);
  app.post('/games/:gameId/turn-draft/confirm', routeOptions, confirmDraft);

  async function getDraft(request: FastifyRequest, reply: FastifyReply) {
    const gameId = parseGameId(request, reply);

    if (gameId === null) {
      return reply;
    }

    const userId = getAuthenticatedUserId(request);
    const snapshot = await gameService.getSnapshot({ gameId, userId });

    if (snapshot.status !== 'found') {
      return sendGameNotFound(reply);
    }

    if (snapshot.view.currentPlayerId !== userId) {
      return reply.send({ draft: null });
    }

    const [storedDraft] = await database
      .select()
      .from(gameTurnDrafts)
      .where(eq(gameTurnDrafts.gameId, gameId));

    if (
      storedDraft === undefined ||
      storedDraft.playerId !== userId ||
      storedDraft.baseVersion !== snapshot.view.lastEventSequence
    ) {
      return reply.send({ draft: null });
    }

    const parsedAction = saveTurnDraftRequestSchema.safeParse({
      action: storedDraft.action,
      coinIndex: storedDraft.coinIndex,
      expectedVersion: storedDraft.baseVersion,
    });

    if (!parsedAction.success) {
      return reply.send({ draft: null });
    }

    const projectedBattlefield = previewTurnAction({
      action: parsedAction.data.action,
      coinIndex: storedDraft.coinIndex,
      playerId: userId,
      view: snapshot.view,
    });

    if (projectedBattlefield === null) {
      return reply.send({ draft: null });
    }

    return reply.send({
      draft: {
        action: parsedAction.data.action,
        baseVersion: storedDraft.baseVersion,
        coinIndex: storedDraft.coinIndex,
        id: storedDraft.id,
        projectedBattlefield,
        revision: storedDraft.revision,
      },
    });
  }

  async function saveDraft(request: FastifyRequest, reply: FastifyReply) {
    const gameId = parseGameId(request, reply);
    const body = saveTurnDraftRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
    }

    const userId = getAuthenticatedUserId(request);
    const snapshot = await gameService.getSnapshot({ gameId, userId });

    if (snapshot.status !== 'found') {
      return sendGameNotFound(reply);
    }

    if (
      snapshot.view.currentPlayerId !== userId ||
      snapshot.view.lastEventSequence !== body.data.expectedVersion
    ) {
      return sendDraftConflict(reply);
    }

    const projectedBattlefield = previewTurnAction({
      action: body.data.action,
      coinIndex: body.data.coinIndex,
      playerId: userId,
      view: snapshot.view,
    });

    if (projectedBattlefield === null) {
      return sendDraftConflict(reply);
    }

    const [previousDraft] = await database
      .select()
      .from(gameTurnDrafts)
      .where(eq(gameTurnDrafts.gameId, gameId));
    const reusableDraft =
      previousDraft?.playerId === userId &&
      previousDraft.baseVersion === body.data.expectedVersion
        ? previousDraft
        : undefined;
    const id = reusableDraft?.id ?? crypto.randomUUID();
    const revision = (reusableDraft?.revision ?? 0) + 1;

    await database
      .insert(gameTurnDrafts)
      .values({
        action: body.data.action,
        baseVersion: body.data.expectedVersion,
        coinIndex: body.data.coinIndex,
        gameId,
        id,
        playerId: userId,
        revision,
      })
      .onConflictDoUpdate({
        target: gameTurnDrafts.gameId,
        set: {
          action: body.data.action,
          baseVersion: body.data.expectedVersion,
          coinIndex: body.data.coinIndex,
          id,
          playerId: userId,
          revision,
        },
      });

    return reply.send({
      draft: {
        action: body.data.action,
        baseVersion: body.data.expectedVersion,
        coinIndex: body.data.coinIndex,
        id,
        projectedBattlefield,
        revision,
      },
    });
  }

  async function cancelDraft(request: FastifyRequest, reply: FastifyReply) {
    const gameId = parseGameId(request, reply);
    const body = cancelTurnDraftRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
    }

    const [storedDraft] = await database
      .select()
      .from(gameTurnDrafts)
      .where(eq(gameTurnDrafts.gameId, gameId));

    if (
      storedDraft === undefined ||
      storedDraft.playerId !== getAuthenticatedUserId(request) ||
      storedDraft.id !== body.data.draftId ||
      storedDraft.revision !== body.data.revision
    ) {
      return sendDraftConflict(reply);
    }

    const [deletedDraft] = await database
      .delete(gameTurnDrafts)
      .where(
        and(
          eq(gameTurnDrafts.gameId, gameId),
          eq(gameTurnDrafts.id, storedDraft.id),
          eq(gameTurnDrafts.revision, storedDraft.revision)
        )
      )
      .returning({ id: gameTurnDrafts.id });

    if (deletedDraft === undefined) {
      return sendDraftConflict(reply);
    }

    return reply.send({ draft: null });
  }

  async function confirmDraft(request: FastifyRequest, reply: FastifyReply) {
    const gameId = parseGameId(request, reply);
    const body = confirmTurnDraftRequestSchema.safeParse(request.body);

    if (gameId === null || !body.success) {
      return gameId === null ? reply : sendInvalidGameRequest(reply);
    }

    const userId = getAuthenticatedUserId(request);
    const [storedDraft] = await database
      .select()
      .from(gameTurnDrafts)
      .where(eq(gameTurnDrafts.gameId, gameId));

    if (
      storedDraft === undefined ||
      storedDraft.playerId !== userId ||
      storedDraft.id !== body.data.draftId ||
      storedDraft.revision !== body.data.revision ||
      storedDraft.baseVersion !== body.data.expectedVersion
    ) {
      return sendDraftConflict(reply);
    }

    const parsedAction = saveTurnDraftRequestSchema.safeParse({
      action: storedDraft.action,
      coinIndex: storedDraft.coinIndex,
      expectedVersion: storedDraft.baseVersion,
    });

    if (!parsedAction.success) {
      return sendDraftConflict(reply);
    }

    const result = await gameService.executeCommand({
      command: {
        action: parsedAction.data.action,
        coinIndex: storedDraft.coinIndex,
        type: 'PerformTurnAction',
      },
      commandId: body.data.commandId,
      expectedVersion: body.data.expectedVersion,
      gameId,
      userId,
    });

    if (result.status === 'saved' || result.status === 'duplicateCommand') {
      await database
        .delete(gameTurnDrafts)
        .where(
          and(
            eq(gameTurnDrafts.gameId, gameId),
            eq(gameTurnDrafts.id, storedDraft.id),
            eq(gameTurnDrafts.revision, storedDraft.revision)
          )
        );
    }

    return sendMutationResult({ gameId, gameService, reply, result, userId });
  }
}

function sendDraftConflict(reply: FastifyReply): FastifyReply {
  return reply.code(409).send({
    error: {
      code: 'game_version_conflict',
      message: 'The turn draft is no longer current.',
    },
  });
}
