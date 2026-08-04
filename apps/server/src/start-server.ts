import { createAuth } from '@war-chest/auth';
import { type DatabaseConnection, createDatabase } from '@war-chest/database';
import type { FastifyInstance } from 'fastify';
import { createApp } from './app.js';
import { loadServerConfig } from './config/index.js';

export async function startServer(): Promise<FastifyInstance> {
  const config = loadServerConfig();
  const databaseConnection = createDatabase();
  let app: FastifyInstance | null = null;

  try {
    const auth = createAuth({ database: databaseConnection.database });
    app = createApp({
      auth,
      databaseConnection,
      webAssetsRoot: config.APP_SERVE_WEB ? config.WEB_ASSETS_ROOT : undefined,
    });

    await checkDatabaseConnection(databaseConnection);
    await app.listen({ host: config.APP_HOST, port: config.APP_PORT });

    return app;
  } catch (error) {
    if (app === null) {
      await databaseConnection.close();
    } else {
      await app.close();
    }

    throw error;
  }
}

async function checkDatabaseConnection(
  databaseConnection: DatabaseConnection
): Promise<void> {
  try {
    await databaseConnection.checkConnection();
  } catch (error) {
    throw new Error(
      'PostgreSQL is unavailable. Check packages/database/env.yaml and make sure the database is running. For local development, run "yarn db:up" and then "yarn db:migrate" before starting the server.',
      { cause: error }
    );
  }
}
