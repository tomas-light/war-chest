import { z } from 'zod';

const booleanSchema = z.preprocess((value) => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}, z.boolean());

export const authConfigSchema = z
  .object({
    AUTH_SESSION_COOKIE_NAME: z
      .string()
      .min(1)
      .regex(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/),
    AUTH_SESSION_TTL_MINUTES: z.coerce.number().int().positive(),
    AUTH_COOKIE_SECURE: booleanSchema,
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']),
    AUTH_EMAIL_CODE_TTL_MINUTES: z.coerce.number().int().positive(),
    AUTH_EMAIL_CODE_HMAC_SECRET: z.string().min(32),
    AUTH_EMAIL_CODE_RESEND_DELAY_SECONDS: z.coerce.number().int().positive(),
    AUTH_EMAIL_CODE_MAX_REQUESTS_PER_HOUR: z.coerce.number().int().positive(),
    AUTH_EMAIL_CODE_IP_MAX_REQUESTS_PER_HOUR: z.coerce
      .number()
      .int()
      .positive(),
    AUTH_EMAIL_CODE_MAX_FAILURES_PER_HOUR: z.coerce.number().int().positive(),
    AUTH_REGISTRATION_TICKET_TTL_MINUTES: z.coerce.number().int().positive(),
    // Ignored compatibility keys let existing secret-bearing env.local.yaml
    // files load until each developer removes the obsolete values locally.
    AUTH_SUCCESS_REDIRECT_URL: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    TELEGRAM_CLIENT_ID: z.string().optional(),
    TELEGRAM_CLIENT_SECRET: z.string().optional(),
    YANDEX_CLIENT_ID: z.string().optional(),
    YANDEX_CLIENT_SECRET: z.string().optional(),
  })
  .strict()
  .superRefine((config, context) => {
    if (config.AUTH_COOKIE_SAME_SITE === 'none' && !config.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_COOKIE_SECURE'],
        message: 'must be true when AUTH_COOKIE_SAME_SITE is "none"',
      });
    }
  });

export type AuthConfig = z.infer<typeof authConfigSchema>;

export const AUTH_CONFIG_KEYS = [
  'AUTH_SESSION_COOKIE_NAME',
  'AUTH_SESSION_TTL_MINUTES',
  'AUTH_COOKIE_SECURE',
  'AUTH_COOKIE_SAME_SITE',
  'AUTH_EMAIL_CODE_TTL_MINUTES',
  'AUTH_EMAIL_CODE_HMAC_SECRET',
  'AUTH_EMAIL_CODE_RESEND_DELAY_SECONDS',
  'AUTH_EMAIL_CODE_MAX_REQUESTS_PER_HOUR',
  'AUTH_EMAIL_CODE_IP_MAX_REQUESTS_PER_HOUR',
  'AUTH_EMAIL_CODE_MAX_FAILURES_PER_HOUR',
  'AUTH_REGISTRATION_TICKET_TTL_MINUTES',
  'AUTH_SUCCESS_REDIRECT_URL',
  'GOOGLE_CLIENT_ID',
  'TELEGRAM_CLIENT_ID',
  'TELEGRAM_CLIENT_SECRET',
  'YANDEX_CLIENT_ID',
  'YANDEX_CLIENT_SECRET',
] as const satisfies readonly (keyof AuthConfig)[];
