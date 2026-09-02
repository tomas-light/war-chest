import { type Database, users } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { PublicUser } from '../PublicUser.js';

interface Input {
  database: Database;
  displayName: string;
  findPublicUser(userId: string): Promise<PublicUser | null>;
  userId: string;
}

export async function updateDisplayName(
  input: Input
): Promise<PublicUser | null> {
  await input.database
    .update(users)
    .set({ displayName: input.displayName })
    .where(eq(users.id, input.userId));

  return input.findPublicUser(input.userId);
}
