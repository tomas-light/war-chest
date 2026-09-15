import { runtimeFeatureFlagsSchema } from '@war-chest/feature-flags';
import {
  type JsonValue,
  CARD_SELECTION_MODES,
  GAME_EVENT_VERSION,
  GAME_EXPANSIONS,
  GAME_FORMATS,
  GAME_RULES_VERSION,
  UNIT_IDS,
} from '@war-chest/game-engine';
import { z } from 'zod';
import type {
  ApiError,
  CompleteCardSelectionRequest,
  CompleteEmailRegistrationRequest,
  ConfirmCardChoiceRequest,
  CreateGameRequest,
  EmailCodeRequestedResponse,
  GameCommandMessage,
  GameErrorMessage,
  GameEventsMessage,
  GameEventsResponse,
  GameJoinMessage,
  GameLeaveMessage,
  GameResponse,
  GameSnapshotMessage,
  GameSyncMessage,
  JoinGameRequest,
  LeaveGameRequest,
  LeaveGameResponse,
  LobbyGamesResponse,
  LobbyUpdatedMessage,
  PublicUser,
  RequestEmailCodeRequest,
  SelectAvatarPresetRequest,
  SessionResponse,
  StartGameRequest,
  SurrenderGameRequest,
  SwapPlayerPositionsRequest,
  UpdateCurrentUserRequest,
  UpdateGameSettingsRequest,
  UserGamesResponse,
  VerifyEmailCodeRequest,
  VerifyEmailCodeResponse,
} from './types.js';
import { AVATAR_PRESETS } from './types.js';

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
const unitIdSchema = z.enum(UNIT_IDS);
const gameFormatSchema = z.enum(GAME_FORMATS);
const cardSelectionModeSchema = z.enum(CARD_SELECTION_MODES);
const gameExpansionSchema = z.enum(GAME_EXPANSIONS);
const gamePreparationSettingsShape = {
  cardSelectionMode: cardSelectionModeSchema,
  expansions: z
    .array(gameExpansionSchema)
    .max(GAME_EXPANSIONS.length)
    .refine(
      (expansions) => new Set(expansions).size === expansions.length,
      'Game expansions must be unique.'
    )
    .readonly(),
};
const gameSettingsSchema = z
  .object({
    ...gamePreparationSettingsShape,
    format: gameFormatSchema,
  })
  .strict();
const eventMetadataSchema = z.object({
  sequence: z.number().int().positive(),
  version: z.literal(GAME_EVENT_VERSION),
});

const publicUserShape = {
  avatarVersion: z.string().nullable(),
  displayName: z.string(),
  id: z.string(),
};

export const publicUserSchema: z.ZodType<PublicUser> = z
  .object(publicUserShape)
  .strict();

const userGameParticipantSchema = z
  .object({
    ...publicUserShape,
    seat: z.number().int().positive(),
    team: gameTeamSchema,
  })
  .strict();

export const userGamesResponseSchema: z.ZodType<UserGamesResponse> = z
  .object({
    items: z
      .array(
        z
          .object({
            finishedAt: z.iso.datetime(),
            id: gameIdSchema,
            participants: z.array(userGameParticipantSchema).readonly(),
            result: z.enum(['defeat', 'victory']),
            settings: gameSettingsSchema,
            team: gameTeamSchema,
            winnerTeam: gameTeamSchema,
          })
          .strict()
      )
      .readonly(),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export const sessionResponseSchema: z.ZodType<SessionResponse> = z
  .object({
    expiresAt: z.iso.datetime(),
    user: publicUserSchema,
  })
  .strict();

export const emailSchema = z.email().trim().toLowerCase();
export const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .regex(/^[\p{L}\p{N}_ -]+$/u);

export const requestEmailCodeRequestSchema: z.ZodType<RequestEmailCodeRequest> =
  z.object({ email: emailSchema }).strict();

type EmailCodeRequestedSchema = z.ZodType<EmailCodeRequestedResponse>;
export const emailCodeRequestedResponseSchema: EmailCodeRequestedSchema = z
  .object({
    expiresAt: z.iso.datetime(),
    resendAvailableAt: z.iso.datetime(),
  })
  .strict();

export const verifyEmailCodeRequestSchema: z.ZodType<VerifyEmailCodeRequest> = z
  .object({
    code: z.string().regex(/^\d{6}$/),
    email: emailSchema,
  })
  .strict();

export const verifyEmailCodeResponseSchema: z.ZodType<VerifyEmailCodeResponse> =
  z.discriminatedUnion('status', [
    z
      .object({
        session: sessionResponseSchema,
        status: z.literal('authenticated'),
      })
      .strict(),
    z
      .object({
        expiresAt: z.iso.datetime(),
        registrationToken: z.string().min(1),
        status: z.literal('registration_required'),
      })
      .strict(),
  ]);

type RegistrationSchema = z.ZodType<CompleteEmailRegistrationRequest>;
export const completeEmailRegistrationRequestSchema: RegistrationSchema = z
  .object({
    displayName: displayNameSchema,
    registrationToken: z.string().min(1),
  })
  .strict();

type UpdateCurrentUserSchema = z.ZodType<UpdateCurrentUserRequest>;
export const updateCurrentUserRequestSchema: UpdateCurrentUserSchema = z
  .object({ displayName: displayNameSchema })
  .strict();

const avatarPresetIdSchema = z.enum(AVATAR_PRESETS);

type SelectAvatarPresetSchema = z.ZodType<SelectAvatarPresetRequest>;
export const selectAvatarPresetRequestSchema: SelectAvatarPresetSchema = z
  .object({ presetId: avatarPresetIdSchema })
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
  .object({
    commandId: z.uuid(),
    format: gameFormatSchema,
  })
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

type ConfirmCardChoiceSchema = z.ZodType<ConfirmCardChoiceRequest>;
export const confirmCardChoiceRequestSchema: ConfirmCardChoiceSchema = z
  .object({
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    unitId: unitIdSchema,
  })
  .strict();

type CompleteCardSelectionSchema = z.ZodType<CompleteCardSelectionRequest>;
export const completeCardSelectionRequestSchema: CompleteCardSelectionSchema = z
  .object({
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export const leaveGameRequestSchema: z.ZodType<LeaveGameRequest> = z
  .object({
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export const leaveGameResponseSchema: z.ZodType<LeaveGameResponse> = z
  .object({ gameId: gameIdSchema })
  .strict();

type SwapPlayerPositionsSchema = z.ZodType<SwapPlayerPositionsRequest>;

export const swapPlayerPositionsRequestSchema: SwapPlayerPositionsSchema = z
  .object({
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

type GameSettingsRequestSchema = z.ZodType<UpdateGameSettingsRequest>;

export const updateGameSettingsRequestSchema: GameSettingsRequestSchema = z
  .object({
    ...gamePreparationSettingsShape,
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

export const surrenderGameRequestSchema: z.ZodType<SurrenderGameRequest> = z
  .object({
    commandId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

const gameViewPlayerSchema = z
  .object({
    cardIds: z.array(unitIdSchema).readonly(),
    defeatReason: z.enum(['disconnectTimeout', 'surrender']).nullable(),
    id: z.string(),
    moveCount: z.number().int().nonnegative(),
    presence: z.enum(['connected', 'defeated', 'disconnected']),
    reconnectDeadline: z.iso.datetime().nullable(),
    seat: z.number().int().positive(),
    team: gameTeamSchema,
  })
  .strict();
const cardSelectionSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            action: z.enum(['ban', 'pick']),
            playerId: z.string(),
            unitId: unitIdSchema,
          })
          .strict()
      )
      .readonly(),
    phase: z.enum(['banning', 'complete', 'picking']),
    playerOrder: z.array(z.string()).readonly(),
    pool: z.array(unitIdSchema).readonly(),
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
    cardSelection: cardSelectionSchema.nullable(),
    creatorId: z.string(),
    currentPlayerId: z.string().nullable(),
    featureFlags: runtimeFeatureFlagsSchema,
    firstPlayerId: z.string().nullable(),
    initiativePlayerId: z.string().nullable(),
    lastEventSequence: z.number().int().positive(),
    moveCount: z.number().int().nonnegative(),
    players: z.array(gameViewPlayerSchema).readonly(),
    privateMoves: z.array(privateMoveSchema).readonly(),
    rulesVersion: z.literal(GAME_RULES_VERSION),
    settings: gameSettingsSchema,
    status: z.enum(['waiting', 'cardSelection', 'active', 'finished']),
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
        creatorId: z.string(),
        featureFlags: runtimeFeatureFlagsSchema,
        rulesVersion: z.literal(GAME_RULES_VERSION),
        settings: gameSettingsSchema,
      })
      .strict(),
    type: z.literal('GameCreated'),
  })
  .strict();
const gameSettingsUpdatedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z.object(gamePreparationSettingsShape).strict(),
    type: z.literal('GameSettingsUpdated'),
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
const playerLeftViewEventSchema = eventMetadataSchema
  .extend({
    payload: z.object({ playerId: z.string() }).strict(),
    type: z.literal('PlayerLeft'),
  })
  .strict();
const playerPositionChangedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        playerId: z.string(),
        seat: z.number().int().positive(),
        team: gameTeamSchema,
      })
      .strict(),
    type: z.literal('PlayerPositionChanged'),
  })
  .strict();
const playerPositionsSwappedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        positions: z.tuple([
          z
            .object({
              playerId: z.string(),
              seat: z.number().int().positive(),
              team: gameTeamSchema,
            })
            .strict(),
          z
            .object({
              playerId: z.string(),
              seat: z.number().int().positive(),
              team: gameTeamSchema,
            })
            .strict(),
        ]),
      })
      .strict(),
    type: z.literal('PlayerPositionsSwapped'),
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
        reason: z.enum(['disconnectTimeout', 'surrender']),
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
const cardsPreparedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        playerOrder: z.array(z.string()).readonly(),
        selection: z.discriminatedUnion('mode', [
          z
            .object({
              assignments: z
                .array(
                  z
                    .object({
                      playerId: z.string(),
                      unitIds: z.array(unitIdSchema).readonly(),
                    })
                    .strict()
                )
                .readonly(),
              mode: z.literal('random'),
            })
            .strict(),
          z
            .object({
              mode: z.enum(['draft', 'eliminationDraft']),
              pool: z.array(unitIdSchema).readonly(),
            })
            .strict(),
        ]),
      })
      .strict(),
    type: z.literal('CardsPrepared'),
  })
  .strict();
const cardChoiceConfirmedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z
      .object({
        action: z.enum(['ban', 'pick']),
        isComplete: z.boolean(),
        nextPhase: z.enum(['banning', 'complete', 'picking']),
        nextPlayerId: z.string().nullable(),
        playerId: z.string(),
        unitId: unitIdSchema,
      })
      .strict(),
    type: z.literal('CardChoiceConfirmed'),
  })
  .strict();
const cardSelectionCompletedViewEventSchema = eventMetadataSchema
  .extend({
    payload: z.object({}).strict(),
    type: z.literal('CardSelectionCompleted'),
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
  cardsPreparedViewEventSchema,
  cardChoiceConfirmedViewEventSchema,
  cardSelectionCompletedViewEventSchema,
  gameCreatedViewEventSchema,
  gameSettingsUpdatedViewEventSchema,
  playerJoinedViewEventSchema,
  playerLeftViewEventSchema,
  playerPositionChangedViewEventSchema,
  playerPositionsSwappedViewEventSchema,
  playerDisconnectedViewEventSchema,
  playerReconnectedViewEventSchema,
  playerDefeatedViewEventSchema,
  gameStartedViewEventSchema,
  testMovePerformedViewEventSchema,
  gameFinishedViewEventSchema,
  viewSequenceAdvancedEventSchema,
]);

const lobbyGamePlayerSchema = z
  .object({
    avatarVersion: z.string().nullable(),
    displayName: z.string(),
    id: z.string(),
    seat: z.number().int().positive(),
    team: gameTeamSchema,
  })
  .strict();

export const gameResponseSchema: z.ZodType<GameResponse> = z
  .object({
    gameId: gameIdSchema,
    players: z.array(lobbyGamePlayerSchema).readonly(),
    view: gameViewSchema,
  })
  .strict();

export const lobbyGamesResponseSchema: z.ZodType<LobbyGamesResponse> = z
  .object({
    currentPlayerGameId: gameIdSchema.nullable(),
    items: z
      .array(
        z
          .object({
            createdAt: z.iso.datetime(),
            id: gameIdSchema,
            players: z.array(lobbyGamePlayerSchema).readonly(),
            settings: gameSettingsSchema,
            startedAt: z.iso.datetime().nullable(),
            status: z.enum(['active', 'waiting']),
          })
          .strict()
      )
      .readonly(),
  })
  .strict();

export const lobbyUpdatedMessageSchema: z.ZodType<LobbyUpdatedMessage> = z
  .object({ gameId: gameIdSchema })
  .strict();

export const gameEventsResponseSchema: z.ZodType<GameEventsResponse> = z
  .object({
    events: z.array(gameViewEventSchema).readonly(),
    gameId: gameIdSchema,
  })
  .strict();

const gameCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CompleteCardSelection') }).strict(),
  z
    .object({
      type: z.literal('ConfirmCardChoice'),
      unitId: unitIdSchema,
    })
    .strict(),
  z.object({ type: z.literal('FinishGame') }).strict(),
  z
    .object({
      seat: z.number().int().positive(),
      team: gameTeamSchema,
      type: z.literal('JoinGame'),
    })
    .strict(),
  z.object({ type: z.literal('LeaveGame') }).strict(),
  z.object({ type: z.literal('StartGame') }).strict(),
  z.object({ type: z.literal('SurrenderGame') }).strict(),
  z.object({ type: z.literal('SwapPlayerPositions') }).strict(),
  z
    .object({
      ...gamePreparationSettingsShape,
      type: z.literal('UpdateGameSettings'),
    })
    .strict(),
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
