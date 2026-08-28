import { runtimeFeatureFlagsSchema } from '@war-chest/feature-flags';
import { z } from 'zod';
import {
  type GameEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from './events.js';
import type { JsonValue } from './state.js';

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
const gameTeamSchema = z.enum(['black', 'white']);
const eventMetadataSchema = z.object({
  sequence: z.number().int().positive(),
  version: z.literal(GAME_EVENT_VERSION),
});
const gameEventDataSchema: z.ZodType<GameEventData> = z.discriminatedUnion(
  'type',
  [
    eventMetadataSchema
      .extend({
        payload: z
          .object({
            creatorId: z.string(),
            featureFlags: runtimeFeatureFlagsSchema,
            rulesVersion: z.literal(GAME_RULES_VERSION),
          })
          .strict(),
        type: z.literal('GameCreated'),
      })
      .strict(),
    eventMetadataSchema
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
      .strict(),
    eventMetadataSchema
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
      .strict(),
    eventMetadataSchema
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
      .strict(),
    eventMetadataSchema
      .extend({
        payload: z
          .object({
            playerId: z.string(),
            reconnectDeadline: z.iso.datetime(),
          })
          .strict(),
        type: z.literal('PlayerDisconnected'),
      })
      .strict(),
    eventMetadataSchema
      .extend({
        payload: z.object({ playerId: z.string() }).strict(),
        type: z.literal('PlayerReconnected'),
      })
      .strict(),
    eventMetadataSchema
      .extend({
        payload: z
          .object({
            playerId: z.string(),
            reason: z.literal('disconnectTimeout'),
          })
          .strict(),
        type: z.literal('PlayerDefeated'),
      })
      .strict(),
    eventMetadataSchema
      .extend({
        payload: z.object({ firstPlayerId: z.string() }).strict(),
        type: z.literal('GameStarted'),
      })
      .strict(),
    eventMetadataSchema
      .extend({
        payload: z
          .object({
            moveNumber: z.number().int().positive(),
            nextPlayerId: z.string(),
            playerId: z.string(),
            privateData: jsonValueSchema,
          })
          .strict(),
        type: z.literal('TestMovePerformed'),
      })
      .strict(),
    eventMetadataSchema
      .extend({
        payload: z.object({ winnerTeam: gameTeamSchema }).strict(),
        type: z.literal('GameFinished'),
      })
      .strict(),
  ]
);

export function parseGameEventData(value: unknown): GameEventData {
  return gameEventDataSchema.parse(value);
}
