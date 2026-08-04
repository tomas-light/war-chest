import { z } from 'zod';

export const serverConfigSchema = z
  .object({
    APP_HOST: z.string().trim().min(1),
    APP_PORT: z.coerce.number().int().min(1).max(65_535),
    DISCONNECTED_PLAYER_TIMEOUT_MINUTES: z.coerce.number().int().positive(),
    FEATURE_FLAGS_RUNTIME_FILE: z.string().trim().min(1),
  })
  .strict();

export type ServerConfig = z.infer<typeof serverConfigSchema>;

export const SERVER_CONFIG_KEYS = [
  'APP_HOST',
  'APP_PORT',
  'DISCONNECTED_PLAYER_TIMEOUT_MINUTES',
  'FEATURE_FLAGS_RUNTIME_FILE',
] as const satisfies readonly (keyof ServerConfig)[];
