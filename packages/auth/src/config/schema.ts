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

const httpUrlSchema = z.url().superRefine((value, context) => {
  const url = new URL(value);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    context.addIssue({
      code: 'custom',
      message: 'must use the http: or https: protocol',
    });
  }
});

export const authConfigSchema = z
  .object({
    AUTH_SESSION_COOKIE_NAME: z
      .string()
      .min(1)
      .regex(/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/),
    AUTH_SESSION_TTL_MINUTES: z.coerce.number().int().positive(),
    AUTH_OAUTH_STATE_TTL_MINUTES: z.coerce.number().int().positive(),
    AUTH_COOKIE_SECURE: booleanSchema,
    AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']),
    AUTH_SUCCESS_REDIRECT_URL: httpUrlSchema,
    AUTH_AVATAR_MAX_SOURCE_BYTES: z.coerce.number().int().positive(),
    AUTH_AVATAR_FETCH_TIMEOUT_MS: z.coerce.number().int().positive(),
    AUTH_AVATAR_SIZE_PX: z.coerce.number().int().positive(),
    GOOGLE_CLIENT_ID: z.string(),
    TELEGRAM_CLIENT_ID: z.string(),
    TELEGRAM_CLIENT_SECRET: z.string(),
    TELEGRAM_AUTHORIZATION_ENDPOINT: httpUrlSchema,
    TELEGRAM_TOKEN_ENDPOINT: httpUrlSchema,
    TELEGRAM_ISSUER: httpUrlSchema,
    TELEGRAM_JWKS_ENDPOINT: httpUrlSchema,
    TELEGRAM_REDIRECT_URI: httpUrlSchema,
    YANDEX_CLIENT_ID: z.string(),
    YANDEX_CLIENT_SECRET: z.string(),
    YANDEX_AUTHORIZATION_ENDPOINT: httpUrlSchema,
    YANDEX_TOKEN_ENDPOINT: httpUrlSchema,
    YANDEX_PROFILE_ENDPOINT: httpUrlSchema,
    YANDEX_REDIRECT_URI: httpUrlSchema,
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
  'AUTH_OAUTH_STATE_TTL_MINUTES',
  'AUTH_COOKIE_SECURE',
  'AUTH_COOKIE_SAME_SITE',
  'AUTH_SUCCESS_REDIRECT_URL',
  'AUTH_AVATAR_MAX_SOURCE_BYTES',
  'AUTH_AVATAR_FETCH_TIMEOUT_MS',
  'AUTH_AVATAR_SIZE_PX',
  'GOOGLE_CLIENT_ID',
  'TELEGRAM_CLIENT_ID',
  'TELEGRAM_CLIENT_SECRET',
  'TELEGRAM_AUTHORIZATION_ENDPOINT',
  'TELEGRAM_TOKEN_ENDPOINT',
  'TELEGRAM_ISSUER',
  'TELEGRAM_JWKS_ENDPOINT',
  'TELEGRAM_REDIRECT_URI',
  'YANDEX_CLIENT_ID',
  'YANDEX_CLIENT_SECRET',
  'YANDEX_AUTHORIZATION_ENDPOINT',
  'YANDEX_TOKEN_ENDPOINT',
  'YANDEX_PROFILE_ENDPOINT',
  'YANDEX_REDIRECT_URI',
] as const satisfies readonly (keyof AuthConfig)[];
