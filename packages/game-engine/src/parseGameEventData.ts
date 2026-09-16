import { runtimeFeatureFlagsSchema } from '@war-chest/feature-flags';
import { z } from 'zod';
import { TEAM_CELL_IDS } from './Battlefield.js';
import {
  type GameEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from './events.js';
import {
  CARD_SELECTION_MODES,
  GAME_EXPANSIONS,
  GAME_FORMATS,
} from './GameSettings.js';
import type { JsonValue } from './state.js';
import { UNIT_IDS } from './UnitId.js';

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
const unitIdSchema = z.enum(UNIT_IDS);
const cellIdSchema = z.enum(TEAM_CELL_IDS);
const battlefieldSchema = z
  .object({
    controlPoints: z.array(
      z
        .object({
          cellId: cellIdSchema,
          fortified: z.boolean(),
          ownerTeam: gameTeamSchema.nullable(),
        })
        .strict()
    ),
    playerResources: z.array(
      z
        .object({
          bag: z.array(unitIdSchema),
          eliminated: z.array(unitIdSchema),
          hand: z.array(unitIdSchema),
          playerId: z.string(),
          supply: z.array(
            z
              .object({
                count: z.number().int().nonnegative(),
                total: z.number().int().positive(),
                unitId: unitIdSchema,
              })
              .strict()
          ),
        })
        .strict()
    ),
    units: z.array(
      z
        .object({
          bolstered: z.number().int().nonnegative(),
          cellId: cellIdSchema,
          id: z.string(),
          ownerId: z.string(),
          unitId: unitIdSchema,
        })
        .strict()
    ),
  })
  .strict();
const gameSettingsSchema = z
  .object({
    cardSelectionMode: z.enum(CARD_SELECTION_MODES),
    expansions: z.array(z.enum(GAME_EXPANSIONS)),
    format: z.enum(GAME_FORMATS),
  })
  .strict();
const gamePreparationSettingsSchema = gameSettingsSchema.omit({ format: true });
const eventMetadataSchema = z.object({
  sequence: z.number().int().positive(),
  version: z.literal(GAME_EVENT_VERSION),
});
const gameEventDataSchema: z.ZodType<GameEventData> = z.discriminatedUnion(
  'type',
  [
    eventMetadataSchema
      .extend({
        payload: battlefieldSchema,
        type: z.literal('BattlefieldPrepared'),
      })
      .strict(),
    eventMetadataSchema
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
      .strict(),
    eventMetadataSchema
      .extend({
        payload: gamePreparationSettingsSchema,
        type: z.literal('GameSettingsUpdated'),
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
        payload: z.object({ playerId: z.string() }).strict(),
        type: z.literal('PlayerLeft'),
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
            reason: z.enum(['disconnectTimeout', 'surrender']),
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
            playerOrder: z.array(z.string()),
            selection: z.discriminatedUnion('mode', [
              z
                .object({
                  assignments: z.array(
                    z
                      .object({
                        playerId: z.string(),
                        unitIds: z.array(unitIdSchema),
                      })
                      .strict()
                  ),
                  mode: z.literal('random'),
                })
                .strict(),
              z
                .object({
                  mode: z.enum(['draft', 'eliminationDraft']),
                  pool: z.array(unitIdSchema),
                })
                .strict(),
            ]),
          })
          .strict(),
        type: z.literal('CardsPrepared'),
      })
      .strict(),
    eventMetadataSchema
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
      .strict(),
    eventMetadataSchema
      .extend({
        payload: z.object({}).strict(),
        type: z.literal('CardSelectionCompleted'),
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
