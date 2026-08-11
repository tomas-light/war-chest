import {
  type FakeDatabase,
  createFakeDatabase,
} from '@war-chest/fake-database';
import { expect, test, vi } from 'vitest';
import { getFakeDatabase } from './getFakeDatabase';

vi.mock('@war-chest/fake-database', { spy: true });

test('creates one fake database for all consumers', async () => {
  const fakeDatabase = {} as FakeDatabase;

  vi.mocked(createFakeDatabase).mockResolvedValue(fakeDatabase);

  const firstDatabasePromise = getFakeDatabase();
  const secondDatabasePromise = getFakeDatabase();

  expect(secondDatabasePromise).toBe(firstDatabasePromise);
  await expect(firstDatabasePromise).resolves.toBe(fakeDatabase);
  expect(createFakeDatabase).toHaveBeenCalledOnce();
});
