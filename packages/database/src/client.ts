import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadDatabaseConfig } from './config/index.js';
import * as schema from './schema/index.js';

export type DatabaseDriver = ReturnType<typeof postgres>;
export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  readonly database: Database;
  readonly driver: DatabaseDriver;
  checkConnection(): Promise<void>;
  close(): Promise<void>;
}

export function createDatabase(): DatabaseConnection {
  const config = loadDatabaseConfig();
  const driver = postgres(config.DATABASE_URL, {
    max: config.DATABASE_POOL_SIZE,
    ssl: config.DATABASE_SSL ? 'require' : false,
  });
  const database = drizzle(driver, { schema });

  return { database, driver, checkConnection, close };

  async function checkConnection(): Promise<void> {
    await driver`select 1 as ok`;
  }

  async function close(): Promise<void> {
    await driver.end();
  }
}
