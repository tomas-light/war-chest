import { fileURLToPath } from 'node:url';
import { parseConfig } from '@war-chest/config';
import type { DatabaseConfig } from './schema.js';
import { DATABASE_CONFIG_KEYS, databaseConfigSchema } from './schema.js';

const DEFAULT_PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

interface LoadDatabaseConfigOptions {
  env?: NodeJS.ProcessEnv;
  packageRoot?: string;
}

export function loadDatabaseConfig(
  loadOptions: LoadDatabaseConfigOptions = {}
): DatabaseConfig {
  return parseConfig(
    {
      configName: 'Database',
      env: loadOptions.env,
      keys: DATABASE_CONFIG_KEYS,
      packageRoot: loadOptions.packageRoot ?? DEFAULT_PACKAGE_ROOT,
    },
    (configValues) => databaseConfigSchema.parse(configValues)
  );
}
