import { z } from 'zod';

export const webConfigSchema = z
  .object({
    GOOGLE_CLIENT_ID: z.string(),
  })
  .strict();

export type WebConfig = z.infer<typeof webConfigSchema>;

export const WEB_CONFIG_KEYS = [
  'GOOGLE_CLIENT_ID',
] as const satisfies readonly (keyof WebConfig)[];
