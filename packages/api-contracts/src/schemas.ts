import { runtimeFeatureFlagsSchema } from '@war-chest/feature-flags';
import {
  type JsonValue,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from '@war-chest/game-engine';
import { z } from 'zod';
import type {
  ApiError,
  CreateGameRequest,
  GameCommandMessage,
  GameErrorMessage,
  GameEventsMessage,
  GameEventsResponse,
  GameJoinMessage,
  GameLeaveMessage,
  GameResponse,
  GameSnapshotMessage,
  GameSyncMessage,
  GoogleLoginRequest,
  JoinGameRequest,
  PublicUser,
  SessionResponse,
  StartGameRequest,
} from './types.js';

export const API_PREFIX = '/api';
export const SOCKET_IO_PATH = `${API_PREFIX}/socket.io`;

const jsonPrimitiveSchema = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.null(),
]);
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ])
);
const gameIdSchema = z.uuid();
const gameTeamSchema = z.enum(['black', 'white']);
const eventMetadataSchema = z.object({
  sequence: z.number().int().positive(),
  version: z.literal(GAME_EVENT_VERSION),
});

export const publicUserSchema: z.ZodType<PublicUser> = z
  .object({
    avatarVersion: z.string().nullable(),
    displayName: z.string(),
    id: z.string(),
  })
  .strict();

export const sessionResponseSchema: z.ZodType<SessionResponse> = z
  .object({
    expiresAt: z.iso.datetime(),
    user: publicUserSchema,
  })
  .strict();

export const googleLoginRequestSchema: z.ZodType<GoogleLoginRequest> = z
  .object({ idToken: z.string().trim().min(1) })
  .strict();

export const apiErrorSchema: z.ZodType<ApiError> = z
  .object({
    error: z
      .object({
        code: z.string(),
        message: z.string(),
      })
      .strict(),
  })
  .strict();

export const createGameRequestSchema: z.ZodType<CreateGameRequest> = z
  .object({ commandId: z.uuid() })
  .strict();

export const gameParamsSchema = z.object({ gameId: gameIdSchema }).strict();

export const gameEventsQuerySchema = z
  .object({
    afterSequence: z.coerce.number().int().nonnegative().default(0),
  })
  .strict();

export const joinGameRequestSchema: z.ZodType<JoinGameRequest> = z
  .object({
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    seat: z.number().int().positive(),
    team: gameTeamSchema,
  })
  .strict();

export const startGameRequestSchema: z.ZodType<StartGameRequest> = z
  .object({
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

const gameViewPlayerSchema = z
  .object({
    id: z.string(),
    moveCount: z.number().int().nonnegative(),
    presence: z.enum(['connected', 'defeated', 'disconnected']),
    reconnectDeadline: z.iso.datetime().nullable(),
    seat: z.number().int().positive(),
    team: gameTeamSchema,
  })
  .strict();
const privateMoveSchema = z
  .object({
    data: jsonValueSchema,
    moveNumber: z.number().int().positive(),
  })
  .strict();

export const gameViewSchema = z
  .object({
    currentPlayerId: z.string().nullable(),
    featureFlags: runtimeFeatureFlagsSchema,
    lastEventSequence: z.number().int().positive(),
    moveCount: z.number().int().nonnegative(),
    players: z.array(gameViewPlayerSchema).readonly(),
    privateMoves: z.array(privateMoveSchema).readonly(),
    rulesVersion: z.literal(GAME_RULES_VERSION),
    status: z.enum(['waiting', 'active', 'finished']),
    teams: z
      .object({
        black: z.array(z.string()).readonly(),
        white: z.array(z.string()).readonly(),
      })
      .strict(),
    winnerTeam: gameTeamSchema.nullable(),
  })
  .strict();

const gameCreatedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        featureFlags: runtimeFeatureFlagsSchema,
        rulesVersion: z.literal(GAME_RULES_VERSION),
      })
      .strict(),
    type: z.literal('GameCreated'),
  })
  .strict();
const playerJoinedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        playerId: z.string(),
        seat: z.number().int().positive(),
        team: gameTeamSchema,
      })
      .strict(),
    type: z.literal('PlayerJoined'),
  })
  .strict();
const playerDisconnectedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        playerId: z.string(),
        reconnectDeadline: z.iso.datetime(),
      })
      .strict(),
    type: z.literal('PlayerDisconnected'),
  })
  .strict();
const playerReconnectedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z.object({ playerId: z.string() }).strict(),
    type: z.literal('PlayerReconnected'),
  })
  .strict();
const playerDefeatedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        playerId: z.string(),
        reason: z.literal('disconnectTimeout'),
      })
      .strict(),
    type: z.literal('PlayerDefeated'),
  })
  .strict();
const gameStartedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z.object({ firstPlayerId: z.string() }).strict(),
    type: z.literal('GameStarted'),
  })
  .strict();
const testMovePerformedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        moveNumber: z.number().int().positive(),
        nextPlayerId: z.string(),
        playerId: z.string(),
        privateData: jsonValueSchema.optional(),
      })
      .strict(),
    type: z.literal('TestMovePerformed'),
  })
  .strict();
const gameFinishedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z.object({ winnerTeam: gameTeamSchema }).strict(),
    type: z.literal('GameFinished'),
  })
  .strict();
const viewSequenceAdvancedEventSchema = eventMetadataSchema
  .extend({ type: z.literal('ViewSequenceAdvanced') })
  .strict();

export const gameViewEventSchema = z.discriminatedUnion('type', [
  gameCreatedViewEventSchema,
  playerJoinedViewEventSchema,
  playerDisconnectedViewEventSchema,
  playerReconnectedViewEventSchema,
  playerDefeatedViewEventSchema,
  gameStartedViewEventSchema,
  testMovePerformedViewEventSchema,
  gameFinishedViewEventSchema,
  viewSequenceAdvancedEventSchema,
]);

export const gameResponseSchema: z.ZodType<GameResponse> = z
  .object({
    gameId: gameIdSchema,
    view: gameViewSchema,
  })
  .strict();

export const gameEventsResponseSchema: z.ZodType<GameEventsResponse> = z
  .object({
    events: z.array(gameViewEventSchema).readonly(),
    gameId: gameIdSchema,
  })
  .strict();

const gameCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('FinishGame') }).strict(),
  z
    .object({
      seat: z.number().int().positive(),
      team: gameTeamSchema,
      type: z.literal('JoinGame'),
    })
    .strict(),
  z.object({ type: z.literal('StartGame') }).strict(),
  z
    .object({
      privateData: jsonValueSchema.optional(),
      type: z.literal('TestMove'),
    })
    .strict(),
]);

export const gameJoinMessageSchema: z.ZodType<GameJoinMessage> = z
  .object({ gameId: gameIdSchema })
  .strict();
export const gameLeaveMessageSchema: z.ZodType<GameLeaveMessage> = z
  .object({ gameId: gameIdSchema })
  .strict();
export const gameSyncMessageSchema: z.ZodType<GameSyncMessage> = z
  .object({
    afterSequence: z.number().int().nonnegative(),
    gameId: gameIdSchema,
  })
  .strict();
export const gameCommandMessageSchema: z.ZodType<GameCommandMessage> = z
  .object({
    command: gameCommandSchema,
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    gameId: gameIdSchema,
  })
  .strict();
export const gameSnapshotMessageSchema: z.ZodType<GameSnapshotMessage> = z
  .object({
    gameId: gameIdSchema,
    view: gameViewSchema,
  })
  .strict();
export const gameEventsMessageSchema: z.ZodType<GameEventsMessage> = z
  .object({
    events: z.array(gameViewEventSchema).readonly(),
    gameId: gameIdSchema,
  })
  .strict();
export const gameErrorMessageSchema: z.ZodType<GameErrorMessage> = z
  .object({
    code: z.string(),
    currentVersion: z.number().int().nonnegative().optional(),
    gameId: gameIdSchema.nullable(),
    message: z.string(),
  })
  .strict();
