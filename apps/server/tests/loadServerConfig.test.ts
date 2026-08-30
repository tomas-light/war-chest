import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { loadServerConfig } from '../src/config/index.js';

const BASE_CONFIG = [
  'APP_ENV: "development"',
  'APP_HOST: "0.0.0.0"',
  'APP_PORT: 3000',
  'APP_SERVE_WEB: false',
  'DISCONNECTED_PLAYER_TIMEOUT_MINUTES: 15',
  'EMPTY_WAITING_GAME_TIMEOUT_MINUTES: 10',
  'FEATURE_FLAGS_RUNTIME_FILE: "feature-flags.base.json"',
  'WEB_ASSETS_ROOT: "web-dist"',
].join('\n');

test('loads base, local, and environment values in priority order', () => {
  withConfigDirectory(
    {
      'env.local.yaml': [
        'APP_PORT: 3100',
        'DISCONNECTED_PLAYER_TIMEOUT_MINUTES: 20',
      ].join('\n'),
      'env.yaml': BASE_CONFIG,
    },
    (packageRoot) => {
      const config = loadServerConfig({
        env: {
          APP_HOST: '127.0.0.1',
          APP_PORT: '3200',
          FEATURE_FLAGS_RUNTIME_FILE: 'feature-flags.environment.json',
        },
        packageRoot,
      });

      expect(config).toEqual({
        APP_ENV: 'development',
        APP_HOST: '127.0.0.1',
        APP_PORT: 3200,
        APP_SERVE_WEB: false,
        DISCONNECTED_PLAYER_TIMEOUT_MINUTES: 20,
        EMPTY_WAITING_GAME_TIMEOUT_MINUTES: 10,
        FEATURE_FLAGS_RUNTIME_FILE: join(
          packageRoot,
          'feature-flags.environment.json'
        ),
        WEB_ASSETS_ROOT: join(packageRoot, 'web-dist'),
      });
    }
  );
});

test('works without env.local.yaml', () => {
  withConfigDirectory({ 'env.yaml': BASE_CONFIG }, (packageRoot) => {
    expect(loadServerConfig({ env: {}, packageRoot }).APP_PORT).toBe(3000);
  });
});

test('rejects an unknown YAML key', () => {
  withConfigDirectory(
    { 'env.yaml': `${BASE_CONFIG}\nUNKNOWN_KEY: true` },
    (packageRoot) => {
      expect(() => loadServerConfig({ env: {}, packageRoot })).toThrow(
        /Invalid server configuration:.*UNKNOWN_KEY/
      );
    }
  );
});

test('rejects a nested YAML value', () => {
  withConfigDirectory(
    {
      'env.yaml': BASE_CONFIG.replace(
        'APP_PORT: 3000',
        'APP_PORT:\n  public: 3000'
      ),
    },
    (packageRoot) => {
      expect(() => loadServerConfig({ env: {}, packageRoot })).toThrow(
        /Server config value "APP_PORT"/
      );
    }
  );
});

test('rejects a port outside the TCP range', () => {
  withConfigDirectory(
    { 'env.yaml': BASE_CONFIG.replace('APP_PORT: 3000', 'APP_PORT: 65536') },
    (packageRoot) => {
      expect(() => loadServerConfig({ env: {}, packageRoot })).toThrow(
        /Invalid server configuration:.*APP_PORT/
      );
    }
  );
});

function withConfigDirectory(
  configFiles: Record<string, string>,
  executeTest: (directory: string) => void
): void {
  const directory = mkdtempSync(join(tmpdir(), 'war-chest-server-config-'));

  try {
    for (const [fileName, fileContent] of Object.entries(configFiles)) {
      writeFileSync(join(directory, fileName), fileContent, 'utf8');
    }

    executeTest(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
