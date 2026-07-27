import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDatabase } from './client.js';
import {
  gameEvents,
  gameParticipants,
  games,
  processedCommands,
  userIdentities,
  users,
} from './schema/index.js';

const seedIdentifiers = {
  firstUser: '10000000-0000-4000-8000-000000000001',
  secondUser: '10000000-0000-4000-8000-000000000002',
  game: '20000000-0000-4000-8000-000000000001',
  command: '30000000-0000-4000-8000-000000000001',
  event: '40000000-0000-4000-8000-000000000001',
} as const;

if (isDirectExecution()) {
  void seedDatabaseFromCommandLine();
}

async function seedDatabaseFromCommandLine(): Promise<void> {
  try {
    await seedDatabase();
    // eslint-disable-next-line no-console
    console.log('🌱 Database seed applied.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  }
}

async function seedDatabase(): Promise<void> {
  const connection = createDatabase();

  try {
    await connection.database.transaction(async (transaction) => {
      await transaction
        .insert(users)
        .values([
          {
            id: seedIdentifiers.firstUser,
            displayName: 'Ada',
          },
          {
            id: seedIdentifiers.secondUser,
            displayName: 'Grace',
          },
        ])
        .onConflictDoNothing();

      await transaction
        .insert(userIdentities)
        .values([
          {
            id: '50000000-0000-4000-8000-000000000001',
            userId: seedIdentifiers.firstUser,
            provider: 'google',
            providerSubject: 'seed-google-user',
          },
          {
            id: '50000000-0000-4000-8000-000000000002',
            userId: seedIdentifiers.secondUser,
            provider: 'telegram',
            providerSubject: 'seed-telegram-user',
          },
        ])
        .onConflictDoNothing();

      await transaction
        .insert(games)
        .values({
          id: seedIdentifiers.game,
          status: 'waiting',
          currentVersion: 1,
        })
        .onConflictDoNothing();

      await transaction
        .insert(gameParticipants)
        .values([
          {
            gameId: seedIdentifiers.game,
            userId: seedIdentifiers.firstUser,
            role: 'player',
            seat: 1,
          },
          {
            gameId: seedIdentifiers.game,
            userId: seedIdentifiers.secondUser,
            role: 'player',
            seat: 2,
          },
        ])
        .onConflictDoNothing();

      await transaction
        .insert(processedCommands)
        .values({
          id: seedIdentifiers.command,
          gameId: seedIdentifiers.game,
          userId: seedIdentifiers.firstUser,
          commandType: 'CreateGame',
        })
        .onConflictDoNothing();

      await transaction
        .insert(gameEvents)
        .values({
          id: seedIdentifiers.event,
          gameId: seedIdentifiers.game,
          commandId: seedIdentifiers.command,
          sequence: 1,
          type: 'GameCreated',
          version: 1,
          payload: {
            featureFlags: {},
            rulesVersion: 1,
          },
        })
        .onConflictDoNothing();
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
