import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { createDatabase } from './client.js';
import {
  gameEvents,
  gameParticipants,
  games,
  processedCommands,
  userIdentities,
  users,
} from './schema/index.js';

const SEED_IDENTIFIERS = {
  firstUser: '10000000-0000-4000-8000-000000000001',
  secondUser: '10000000-0000-4000-8000-000000000002',
  game: '20000000-0000-4000-8000-000000000001',
  command: '30000000-0000-4000-8000-000000000001',
  event: '40000000-0000-4000-8000-000000000001',
} as const;
const CREATE_GAME_REQUEST_HASH =
  'bdea43dc54d89791fa249a3ef1786b10e6cfe2be12570ab18fbb1a77b5161e02';

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
            id: SEED_IDENTIFIERS.firstUser,
            displayName: 'Ada',
          },
          {
            id: SEED_IDENTIFIERS.secondUser,
            displayName: 'Grace',
          },
        ])
        .onConflictDoNothing();

      await transaction
        .insert(userIdentities)
        .values([
          {
            id: '50000000-0000-4000-8000-000000000001',
            userId: SEED_IDENTIFIERS.firstUser,
            provider: 'google',
            providerSubject: 'seed-google-user',
          },
          {
            id: '50000000-0000-4000-8000-000000000002',
            userId: SEED_IDENTIFIERS.secondUser,
            provider: 'telegram',
            providerSubject: 'seed-telegram-user',
          },
        ])
        .onConflictDoNothing();

      await transaction
        .insert(games)
        .values({
          id: SEED_IDENTIFIERS.game,
          status: 'waiting',
          currentVersion: 1,
        })
        .onConflictDoNothing();

      await transaction
        .insert(gameParticipants)
        .values([
          {
            gameId: SEED_IDENTIFIERS.game,
            userId: SEED_IDENTIFIERS.firstUser,
            seat: 1,
            team: 'white',
          },
          {
            gameId: SEED_IDENTIFIERS.game,
            userId: SEED_IDENTIFIERS.secondUser,
            seat: 1,
            team: 'black',
          },
        ])
        .onConflictDoNothing();

      await transaction
        .insert(processedCommands)
        .values({
          id: SEED_IDENTIFIERS.command,
          gameId: SEED_IDENTIFIERS.game,
          userId: SEED_IDENTIFIERS.firstUser,
          commandType: 'CreateGame',
          requestHash: CREATE_GAME_REQUEST_HASH,
        })
        .onConflictDoNothing();

      await transaction
        .insert(gameEvents)
        .values({
          id: SEED_IDENTIFIERS.event,
          gameId: SEED_IDENTIFIERS.game,
          commandId: SEED_IDENTIFIERS.command,
          sequence: 1,
          type: 'GameCreated',
          version: 1,
          payload: {
            creatorId: SEED_IDENTIFIERS.firstUser,
            featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
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
