import type { AvatarPresetId } from '@war-chest/api-contracts';
import { type Database, userAvatars, users } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { PublicUser } from '../PublicUser.js';

interface Input {
  database: Database;
  findPublicUser(userId: string): Promise<PublicUser | null>;
  presetId: AvatarPresetId;
  userId: string;
}

export async function selectAvatarPreset(
  input: Input
): Promise<PublicUser | null> {
  await input.database.transaction(async (transaction) => {
    await transaction
      .update(users)
      .set({ avatarPresetId: input.presetId })
      .where(eq(users.id, input.userId));
    await transaction
      .delete(userAvatars)
      .where(eq(userAvatars.userId, input.userId));
  });

  return input.findPublicUser(input.userId);
}
