import { z } from 'zod';

export const webConfigSchema = z
  .object({
    // Accepted but never exposed to the bundle; developers can remove it from
    // their ignored env.local.yaml without coordinating a repository change.
    GOOGLE_CLIENT_ID: z.string().optional(),
    __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: z.string(),
  })
  .strict();

export type WebConfig = z.infer<typeof webConfigSchema>;

export const WEB_CONFIG_KEYS = [
  'GOOGLE_CLIENT_ID',
  '__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS',
] as const satisfies readonly (keyof WebConfig)[];
