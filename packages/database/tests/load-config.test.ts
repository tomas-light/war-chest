import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { loadDatabaseConfig } from '../src/config/index.js';

test('loads base, local, and environment values in priority order', () => {
  withConfigDirectory(
    {
      'env.yaml': [
        'DATABASE_URL: "postgres://base:base@localhost/base"',
        'DATABASE_POOL_SIZE: 10',
        'DATABASE_SSL: false',
      ].join('\n'),
      'env.local.yaml': [
        'DATABASE_URL: "postgres://local:local@localhost/local"',
        'DATABASE_POOL_SIZE: 20',
      ].join('\n'),
    },
    (packageRoot) => {
      const config = loadDatabaseConfig({
        packageRoot,
        env: {
          DATABASE_POOL_SIZE: '30',
          DATABASE_SSL: 'true',
        },
      });

      expect(config).toEqual({
        DATABASE_URL: 'postgres://local:local@localhost/local',
        DATABASE_POOL_SIZE: 30,
        DATABASE_SSL: true,
      });
    }
  );
});

test('works without env.local.yaml', () => {
  withConfigDirectory(
    {
      'env.yaml': [
        'DATABASE_URL: "postgres://base:base@localhost/base"',
        'DATABASE_POOL_SIZE: 10',
        'DATABASE_SSL: false',
      ].join('\n'),
    },
    (packageRoot) => {
      expect(
        loadDatabaseConfig({
          packageRoot,
          env: {},
        }).DATABASE_POOL_SIZE
      ).toBe(10);
    }
  );
});

test('rejects unknown and nested YAML keys', () => {
  withConfigDirectory(
    {
      'env.yaml': [
        'DATABASE_URL: "postgres://base:base@localhost/base"',
        'DATABASE_POOL_SIZE: 10',
        'DATABASE_SSL: false',
        'UNKNOWN_KEY: true',
      ].join('\n'),
    },
    (packageRoot) => {
      expect(() =>
        loadDatabaseConfig({
          packageRoot,
          env: {},
        })
      ).toThrow(/Invalid database configuration:.*UNKNOWN_KEY/);
    }
  );

  withConfigDirectory(
    {
      'env.yaml': [
        'DATABASE_URL: "postgres://base:base@localhost/base"',
        'DATABASE_POOL_SIZE:',
        '  min: 1',
        'DATABASE_SSL: false',
      ].join('\n'),
    },
    (packageRoot) => {
      expect(() =>
        loadDatabaseConfig({
          packageRoot,
          env: {},
        })
      ).toThrow(/Database config value "DATABASE_POOL_SIZE"/);
    }
  );
});

function withConfigDirectory(
  configFiles: Record<string, string>,
  executeTest: (directory: string) => void
): void {
  const directory = mkdtempSync(join(tmpdir(), 'war-chest-database-config-'));

  try {
    for (const [fileName, fileContent] of Object.entries(configFiles)) {
      writeFileSync(join(directory, fileName), fileContent, 'utf8');
    }

    executeTest(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
