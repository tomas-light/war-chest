import {
  type FakeDatabase,
  createFakeDatabase,
} from '@war-chest/fake-database';

let fakeDatabasePromise: Promise<FakeDatabase> | undefined;

export function getFakeDatabase(): Promise<FakeDatabase> {
  fakeDatabasePromise ??= createFakeDatabase();

  return fakeDatabasePromise;
}
