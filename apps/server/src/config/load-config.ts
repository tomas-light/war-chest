import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig } from '@war-chest/config';
import type { ServerConfig } from './schema.js';
import { SERVER_CONFIG_KEYS, serverConfigSchema } from './schema.js';

const DEFAULT_PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export interface LoadServerConfigOptions {
  env?: NodeJS.ProcessEnv;
  packageRoot?: string;
}

export function loadServerConfig(
  loadOptions: LoadServerConfigOptions = {}
): ServerConfig {
  const packageRoot = resolve(loadOptions.packageRoot ?? DEFAULT_PACKAGE_ROOT);
  const config = parseConfig(
    {
      configName: 'Server',
      env: loadOptions.env,
      keys: SERVER_CONFIG_KEYS,
      packageRoot,
    },
    (configValues) => serverConfigSchema.parse(configValues)
  );

  return {
    ...config,
    FEATURE_FLAGS_RUNTIME_FILE: resolve(
      packageRoot,
      config.FEATURE_FLAGS_RUNTIME_FILE
    ),
  };
}
