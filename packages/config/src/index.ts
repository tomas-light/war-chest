import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { ZodError } from 'zod';

type ConfigValue = string | number | boolean;
type ConfigValues = Record<string, ConfigValue>;

interface ParseConfigOptions<ConfigKey extends string> {
  configName: string;
  env?: NodeJS.ProcessEnv;
  keys: readonly ConfigKey[];
  packageRoot: string;
}

export function parseConfig<ConfigKey extends string, Config>(
  options: ParseConfigOptions<ConfigKey>,
  parseConfigValues: (configValues: ConfigValues) => Config
): Config {
  const configValues = loadConfigValues(options);

  try {
    return parseConfigValues(configValues);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `Invalid ${options.configName.toLowerCase()} configuration: ${formatValidationError(error)}`,
        { cause: error }
      );
    }

    throw error;
  }
}

function loadConfigValues<ConfigKey extends string>(
  options: ParseConfigOptions<ConfigKey>
): ConfigValues {
  const packageRoot = resolve(options.packageRoot);
  const baseConfig = readConfigFile(
    resolve(packageRoot, 'env.yaml'),
    true,
    options
  );
  const localConfig = readConfigFile(
    resolve(packageRoot, 'env.local.yaml'),
    false,
    options
  );
  const environmentConfig = readEnvironmentOverrides(
    options.env ?? process.env,
    options.keys
  );

  return {
    ...baseConfig,
    ...localConfig,
    ...environmentConfig,
  };
}

function readConfigFile<ConfigKey extends string>(
  configFilePath: string,
  isRequired: boolean,
  options: ParseConfigOptions<ConfigKey>
): ConfigValues {
  if (!existsSync(configFilePath)) {
    if (isRequired) {
      throw new Error(
        `${options.configName} config file does not exist: ${configFilePath}`
      );
    }

    return {};
  }

  let document: unknown;

  try {
    document = parse(readFileSync(configFilePath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Cannot parse ${options.configName.toLowerCase()} config file: ${configFilePath}`,
      { cause: error }
    );
  }

  if (
    document === null ||
    typeof document !== 'object' ||
    Array.isArray(document)
  ) {
    throw new Error(
      `${options.configName} config must be a flat YAML object: ${configFilePath}`
    );
  }

  const configValues: ConfigValues = {};

  for (const [key, value] of Object.entries(document)) {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new Error(
        `${options.configName} config value "${key}" must be a string, number, or boolean: ${configFilePath}`
      );
    }

    configValues[key] = value;
  }

  return configValues;
}

function readEnvironmentOverrides<ConfigKey extends string>(
  env: NodeJS.ProcessEnv,
  keys: readonly ConfigKey[]
): ConfigValues {
  const environmentOverrides: ConfigValues = {};

  for (const key of keys) {
    const value = env[key];

    if (value !== undefined) {
      environmentOverrides[key] = value;
    }
  }

  return environmentOverrides;
}

function formatValidationError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const issuePath = issue.path.length > 0 ? issue.path.join('.') : 'config';
      return `${issuePath}: ${issue.message}`;
    })
    .join('; ');
}
