import { z } from 'zod';

const booleanConfigSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((value) => value === 'true'),
]);

export const serverConfigSchema = z
  .object({
    APP_HOST: z.string().trim().min(1),
    APP_PORT: z.coerce.number().int().min(1).max(65_535),
    APP_SERVE_WEB: booleanConfigSchema,
    DISCONNECTED_PLAYER_TIMEOUT_MINUTES: z.coerce.number().int().positive(),
    EMPTY_WAITING_GAME_TIMEOUT_MINUTES: z.coerce.number().int().positive(),
    FEATURE_FLAGS_RUNTIME_FILE: z.string().trim().min(1),
    WEB_ASSETS_ROOT: z.string().trim().min(1),
  })
  .strict();

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export const SERVER_CONFIG_KEYS = [
  'APP_HOST',
  'APP_PORT',
  'APP_SERVE_WEB',
  'DISCONNECTED_PLAYER_TIMEOUT_MINUTES',
  'EMPTY_WAITING_GAME_TIMEOUT_MINUTES',
  'FEATURE_FLAGS_RUNTIME_FILE',
  'WEB_ASSETS_ROOT',
] as const satisfies readonly (keyof ServerConfig)[];
