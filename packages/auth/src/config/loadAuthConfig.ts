import { fileURLToPath } from 'node:url';
import { parseConfig } from '@war-chest/config';
import type { AuthConfig } from './schema.js';
import { AUTH_CONFIG_KEYS, authConfigSchema } from './schema.js';

const DEFAULT_PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export interface LoadAuthConfigOptions {
  env?: NodeJS.ProcessEnv;
  packageRoot?: string;
}

export function loadAuthConfig(
  loadOptions: LoadAuthConfigOptions = {}
): AuthConfig {
  return parseConfig(
    {
      configName: 'Auth',
      env: loadOptions.env,
      keys: AUTH_CONFIG_KEYS,
      packageRoot: loadOptions.packageRoot ?? DEFAULT_PACKAGE_ROOT,
    },
    (configValues) => authConfigSchema.parse(configValues)
  );
}
