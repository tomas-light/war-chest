import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { ZodError } from 'zod';
import type { DatabaseConfig } from './schema.js';
import { databaseConfigKeys, databaseConfigSchema } from './schema.js';

const defaultPackageRoot = fileURLToPath(new URL('../../', import.meta.url));

type FlatConfigValue = string | number | boolean;
type FlatConfig = Record<string, FlatConfigValue>;

interface LoadDatabaseConfigOptions {
  env?: NodeJS.ProcessEnv;
  packageRoot?: string;
}

export class DatabaseConfigError extends Error {
  override readonly name = 'DatabaseConfigError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export function loadDatabaseConfig(
  loadOptions: LoadDatabaseConfigOptions = {}
): DatabaseConfig {
  const packageRoot = resolve(loadOptions.packageRoot ?? defaultPackageRoot);
  const baseConfig = readConfigFile(resolve(packageRoot, 'env.yaml'), true);
  const localConfig = readConfigFile(
    resolve(packageRoot, 'env.local.yaml'),
    false
  );
  const environmentConfig = readEnvironmentOverrides(
    loadOptions.env ?? process.env
  );

  try {
    return databaseConfigSchema.parse({
      ...baseConfig,
      ...localConfig,
      ...environmentConfig,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      throw new DatabaseConfigError(
        `Invalid database configuration: ${formatValidationError(error)}`,
        { cause: error }
      );
    }

    throw error;
  }
}

function readConfigFile(
  configFilePath: string,
  isRequired: boolean
): FlatConfig {
  if (!existsSync(configFilePath)) {
    if (isRequired) {
      throw new DatabaseConfigError(
        `Database config file does not exist: ${configFilePath}`
      );
    }

    return {};
  }

  let document: unknown;

  try {
    document = parse(readFileSync(configFilePath, 'utf8'));
  } catch (error) {
    throw new DatabaseConfigError(
      `Cannot parse database config file: ${configFilePath}`,
      {
        cause: error,
      }
    );
  }

  if (
    document === null ||
    typeof document !== 'object' ||
    Array.isArray(document)
  ) {
    throw new DatabaseConfigError(
      `Database config must be a flat YAML object: ${configFilePath}`
    );
  }

  const flatConfig: FlatConfig = {};

  for (const [key, value] of Object.entries(document)) {
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new DatabaseConfigError(
        `Database config value "${key}" must be a string, number, or boolean: ${configFilePath}`
      );
    }

    flatConfig[key] = value;
  }

  return flatConfig;
}

function readEnvironmentOverrides(env: NodeJS.ProcessEnv): FlatConfig {
  const environmentOverrides: FlatConfig = {};

  for (const key of databaseConfigKeys) {
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
