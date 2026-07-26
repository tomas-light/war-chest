import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from './client.js';

const defaultMigrationsFolder = fileURLToPath(
  new URL('../migrations', import.meta.url)
);

if (isDirectExecution()) {
  void runMigrationsFromCommandLine();
}

async function runMigrationsFromCommandLine(): Promise<void> {
  try {
    await runMigrations();
    // eslint-disable-next-line no-console
    console.log('✅ Database migrations applied.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  }
}

async function runMigrations(): Promise<void> {
  const connection = createDatabase();

  try {
    await migrate(connection.database, {
      migrationsFolder: resolve(defaultMigrationsFolder),
    });
  } finally {
    await connection.close();
  }
}

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  return (
    entryPoint !== undefined &&
    pathToFileURL(resolve(entryPoint)).href === import.meta.url
  );
}
