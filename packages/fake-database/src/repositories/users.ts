import type { FakeDatabaseConnection, FakeUser } from '../schema.js';
import { createSchemaTable } from '../Table.js';

export interface FakeUserRepository {
  findByEmail(email: string): Promise<FakeUser | null>;
  getById(userId: string): Promise<FakeUser | null>;
  save(user: FakeUser): Promise<void>;
}

export function createFakeUserRepository(
  database: FakeDatabaseConnection
): FakeUserRepository {
  const userTable = createSchemaTable(database, 'users');

  return { findByEmail, getById, save };

  async function findByEmail(email: string): Promise<FakeUser | null> {
    const users = await userTable.getAll();
    return users.find((user) => user.email === email) ?? null;
  }

  async function getById(userId: string): Promise<FakeUser | null> {
    return (await userTable.get(userId)) ?? null;
  }

  async function save(user: FakeUser): Promise<void> {
    if ((await userTable.get(user.id)) === undefined) {
      await userTable.insert(user.id, user);
    } else {
      await userTable.update(user.id, user);
    }
  }
}
