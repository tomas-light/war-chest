import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { loadAuthConfig } from '../src/config/index.js';

const BASE_CONFIG = [
  'AUTH_SESSION_COOKIE_NAME: "war_chest_session"',
  'AUTH_SESSION_TTL_MINUTES: 60',
  'AUTH_OAUTH_STATE_TTL_MINUTES: 10',
  'AUTH_COOKIE_SECURE: false',
  'AUTH_COOKIE_SAME_SITE: "lax"',
  'AUTH_SUCCESS_REDIRECT_URL: "http://localhost:5173"',
  'AUTH_AVATAR_MAX_SOURCE_BYTES: 1048576',
  'AUTH_AVATAR_FETCH_TIMEOUT_MS: 5000',
  'AUTH_AVATAR_SIZE_PX: 256',
  'GOOGLE_CLIENT_ID: ""',
  'TELEGRAM_CLIENT_ID: ""',
  'TELEGRAM_CLIENT_SECRET: ""',
  'TELEGRAM_AUTHORIZATION_ENDPOINT: "https://oauth.telegram.org/auth"',
  'TELEGRAM_TOKEN_ENDPOINT: "https://oauth.telegram.org/token"',
  'TELEGRAM_ISSUER: "https://oauth.telegram.org"',
  'TELEGRAM_JWKS_ENDPOINT: "https://oauth.telegram.org/.well-known/jwks.json"',
  'TELEGRAM_REDIRECT_URI: "http://localhost:3000/auth/telegram/callback"',
  'YANDEX_CLIENT_ID: ""',
  'YANDEX_CLIENT_SECRET: ""',
  'YANDEX_AUTHORIZATION_ENDPOINT: "https://oauth.yandex.ru/authorize"',
  'YANDEX_TOKEN_ENDPOINT: "https://oauth.yandex.ru/token"',
  'YANDEX_PROFILE_ENDPOINT: "https://login.yandex.ru/info"',
  'YANDEX_REDIRECT_URI: "http://localhost:3000/auth/yandex/callback"',
].join('\n');

test('loads base, local, and environment values in priority order', () => {
  withConfigDirectory(
    {
      'env.local.yaml': [
        'AUTH_SESSION_TTL_MINUTES: 120',
        'AUTH_OAUTH_STATE_TTL_MINUTES: 15',
        'GOOGLE_CLIENT_ID: "local-client"',
      ].join('\n'),
      'env.yaml': BASE_CONFIG,
    },
    (packageRoot) => {
      const config = loadAuthConfig({
        env: {
          AUTH_COOKIE_SECURE: 'true',
          AUTH_OAUTH_STATE_TTL_MINUTES: '20',
          GOOGLE_CLIENT_ID: 'environment-client',
          TELEGRAM_TOKEN_ENDPOINT: 'https://telegram.example/token',
        },
        packageRoot,
      });

      expect(config.AUTH_SESSION_TTL_MINUTES).toBe(120);
      expect(config.AUTH_OAUTH_STATE_TTL_MINUTES).toBe(20);
      expect(config.AUTH_COOKIE_SECURE).toBe(true);
      expect(config.GOOGLE_CLIENT_ID).toBe('environment-client');
      expect(config.TELEGRAM_TOKEN_ENDPOINT).toBe(
        'https://telegram.example/token'
      );
    }
  );
});

test('rejects unknown and nested YAML keys', () => {
  withConfigDirectory(
    {
      'env.yaml': `${BASE_CONFIG}\nUNKNOWN_KEY: true`,
    },
    (packageRoot) => {
      expect(() => loadAuthConfig({ env: {}, packageRoot })).toThrow(
        /Invalid auth configuration:.*UNKNOWN_KEY/
      );
    }
  );

  withConfigDirectory(
    {
      'env.yaml': BASE_CONFIG.replace(
        'AUTH_AVATAR_SIZE_PX: 256',
        'AUTH_AVATAR_SIZE_PX:\n  width: 256'
      ),
    },
    (packageRoot) => {
      expect(() => loadAuthConfig({ env: {}, packageRoot })).toThrow(
        /Auth config value "AUTH_AVATAR_SIZE_PX"/
      );
    }
  );
});

test('requires secure cookies for SameSite=None', () => {
  withConfigDirectory(
    {
      'env.yaml': BASE_CONFIG.replace(
        'AUTH_COOKIE_SAME_SITE: "lax"',
        'AUTH_COOKIE_SAME_SITE: "none"'
      ),
    },
    (packageRoot) => {
      expect(() => loadAuthConfig({ env: {}, packageRoot })).toThrow(
        /AUTH_COOKIE_SECURE/
      );
    }
  );
});

function withConfigDirectory(
  configFiles: Record<string, string>,
  executeTest: (directory: string) => void
): void {
  const directory = mkdtempSync(join(tmpdir(), 'war-chest-auth-config-'));

  try {
    for (const [fileName, fileContent] of Object.entries(configFiles)) {
      writeFileSync(join(directory, fileName), fileContent, 'utf8');
    }

    executeTest(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
