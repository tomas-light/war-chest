import { type Database, userAvatars, users } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { PublicUser } from '../PublicUser.js';

interface Input {
  database: Database;
  findPublicUser(userId: string): Promise<PublicUser | null>;
  userId: string;
}

export async function removeAvatar(input: Input): Promise<PublicUser | null> {
  await input.database.transaction(async (transaction) => {
    await transaction
      .delete(userAvatars)
      .where(eq(userAvatars.userId, input.userId));
    await transaction
      .update(users)
      .set({ avatarPresetId: null })
      .where(eq(users.id, input.userId));
  });

  return input.findPublicUser(input.userId);
}
