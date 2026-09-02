import { type Database, userAvatars, users } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { PublicUser } from '../PublicUser.js';
import type { CustomAvatar } from './UserRepositoryTypes.js';

interface Input {
  avatar: CustomAvatar;
  database: Database;
  findPublicUser(userId: string): Promise<PublicUser | null>;
  userId: string;
}

export async function saveAvatar(input: Input): Promise<PublicUser | null> {
  await input.database.transaction(async (transaction) => {
    await transaction
      .insert(userAvatars)
      .values({ ...input.avatar, userId: input.userId })
      .onConflictDoUpdate({
        set: input.avatar,
        target: userAvatars.userId,
      });
    await transaction
      .update(users)
      .set({ avatarPresetId: null })
      .where(eq(users.id, input.userId));
  });

  return input.findPublicUser(input.userId);
}
