import type {
  FakeAuthProvider,
  FakeDatabaseConnection,
  FakeUser,
  FakeUserIdentity,
} from '../schema.js';
import { createSchemaTable, runSchemaTableTransaction } from '../Table.js';

export interface FakeUserWithIdentity {
  identity: FakeUserIdentity;
  user: FakeUser;
}

export interface FakeUserRepository {
  findByIdentity(
    provider: FakeAuthProvider,
    providerSubject: string
  ): Promise<FakeUserWithIdentity | null>;
  getById(userId: string): Promise<FakeUser | null>;
  listIdentities(userId: string): Promise<FakeUserIdentity[]>;
  saveWithIdentity(user: FakeUser, identity: FakeUserIdentity): Promise<void>;
}

export function createFakeUserRepository(
  database: FakeDatabaseConnection
): FakeUserRepository {
  const userTable = createSchemaTable(database, 'users');
  const userIdentityTable = createSchemaTable(database, 'userIdentities');

  return {
    findByIdentity,
    getById,
    listIdentities,
    saveWithIdentity,
  };

  async function findByIdentity(
    provider: FakeAuthProvider,
    providerSubject: string
  ): Promise<FakeUserWithIdentity | null> {
    const identities = await userIdentityTable.getAll();
    const identity = identities.find(
      (candidate) =>
        candidate.provider === provider &&
        candidate.providerSubject === providerSubject
    );

    if (identity === undefined) {
      return null;
    }

    const user = await userTable.get(identity.userId);

    if (user === undefined) {
      throw new Error(
        `Fake identity ${identity.id} references a missing user ${identity.userId}.`
      );
    }

    return { identity, user };
  }

  async function getById(userId: string): Promise<FakeUser | null> {
    return (await userTable.get(userId)) ?? null;
  }

  async function listIdentities(userId: string): Promise<FakeUserIdentity[]> {
    const identities = await userIdentityTable.getAll();
    return identities.filter((identity) => identity.userId === userId);
  }

  async function saveWithIdentity(
    user: FakeUser,
    identity: FakeUserIdentity
  ): Promise<void> {
    if (identity.userId !== user.id) {
      throw new Error('Fake identity must reference the saved user.');
    }

    await runSchemaTableTransaction(
      database,
      ['users', 'userIdentities'],
      async (transaction) => {
        const users = transaction.table('users');
        const userIdentities = transaction.table('userIdentities');
        const identities = await userIdentities.getAll();
        const duplicateIdentity = identities.find(
          (candidate) =>
            candidate.id !== identity.id &&
            candidate.provider === identity.provider &&
            candidate.providerSubject === identity.providerSubject
        );

        if (duplicateIdentity !== undefined) {
          throw new Error('Fake provider identity must be unique.');
        }

        if ((await users.get(user.id)) === undefined) {
          await users.insert(user.id, user);
        } else {
          await users.update(user.id, user);
        }

        if ((await userIdentities.get(identity.id)) === undefined) {
          await userIdentities.insert(identity.id, identity);
        } else {
          await userIdentities.update(identity.id, identity);
        }
      }
    );
  }
}
