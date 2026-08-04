import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseConfig } from '@war-chest/config';
import type { WebConfig } from './schema.js';
import { WEB_CONFIG_KEYS, webConfigSchema } from './schema.js';

const DEFAULT_PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));

interface LoadWebConfigOptions {
  env?: NodeJS.ProcessEnv;
  packageRoot?: string;
}

export function loadWebConfig(
  loadOptions: LoadWebConfigOptions = {}
): WebConfig {
  const packageRoot = resolve(loadOptions.packageRoot ?? DEFAULT_PACKAGE_ROOT);

  return parseConfig(
    {
      configName: 'Web',
      env: loadOptions.env,
      keys: WEB_CONFIG_KEYS,
      packageRoot,
    },
    (configValues) => webConfigSchema.parse(configValues)
  );
}
