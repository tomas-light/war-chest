import { z } from 'zod';

const databaseUrlSchema = z
  .string()
  .min(1)
  .superRefine((value, context) => {
    try {
      const url = new URL(value);

      if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
        context.addIssue({
          code: 'custom',
          message: 'must use the postgres: or postgresql: protocol',
        });
      }
    } catch {
      context.addIssue({
        code: 'custom',
        message: 'must be a valid PostgreSQL connection URL',
      });
    }
  });

const booleanSchema = z.preprocess((value) => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}, z.boolean());

export const databaseConfigSchema = z
  .object({
    DATABASE_URL: databaseUrlSchema,
    DATABASE_POOL_SIZE: z.coerce.number().int().positive(),
    DATABASE_SSL: booleanSchema,
  })
  .strict();

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

export const DATABASE_CONFIG_KEYS = [
  'DATABASE_URL',
  'DATABASE_POOL_SIZE',
  'DATABASE_SSL',
] as const satisfies readonly (keyof DatabaseConfig)[];
