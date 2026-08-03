import type { FakeAuthSession, FakeDatabaseConnection } from '../schema.js';
import { createSchemaTable, runSchemaTableTransaction } from '../table.js';

export interface FakeSessionRepository {
  findActive(sessionId: string, now?: Date): Promise<FakeAuthSession | null>;
  getById(sessionId: string): Promise<FakeAuthSession | null>;
  revoke(sessionId: string, revokedAt?: Date): Promise<boolean>;
  save(session: FakeAuthSession): Promise<void>;
}

export function createFakeSessionRepository(
  database: FakeDatabaseConnection
): FakeSessionRepository {
  const authSessionTable = createSchemaTable(database, 'authSessions');

  return { findActive, getById, revoke, save };

  async function findActive(
    sessionId: string,
    now = new Date()
  ): Promise<FakeAuthSession | null> {
    const session = await getById(sessionId);

    if (
      session === null ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= now.getTime()
    ) {
      return null;
    }

    return session;
  }

  async function getById(sessionId: string): Promise<FakeAuthSession | null> {
    return (await authSessionTable.get(sessionId)) ?? null;
  }

  async function revoke(
    sessionId: string,
    revokedAt = new Date()
  ): Promise<boolean> {
    return runSchemaTableTransaction(
      database,
      ['authSessions'],
      async (transaction) => {
        const authSessions = transaction.table('authSessions');
        const session = await authSessions.get(sessionId);

        if (session === undefined || session.revokedAt !== null) {
          return false;
        }

        await authSessions.update(sessionId, { ...session, revokedAt });
        return true;
      }
    );
  }

  async function save(session: FakeAuthSession): Promise<void> {
    await runSchemaTableTransaction(
      database,
      ['users', 'authSessions'],
      async (transaction) => {
        const users = transaction.table('users');
        const authSessions = transaction.table('authSessions');
        const user = await users.get(session.userId);

        if (user === undefined) {
          throw new Error(
            `Fake session ${session.id} references a missing user ${session.userId}.`
          );
        }

        await authSessions.insert(session.id, session);
      }
    );
  }
}
