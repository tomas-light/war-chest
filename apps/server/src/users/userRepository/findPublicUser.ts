import { type Database, userAvatars, users } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { PublicUser } from '../PublicUser.js';
import { toPublicUser } from './toPublicUser.js';

export async function findPublicUser(
  database: Database,
  userId: string
): Promise<PublicUser | null> {
  const [user] = await database
    .select({
      avatarHash: userAvatars.contentHash,
      avatarPresetId: users.avatarPresetId,
      displayName: users.displayName,
      id: users.id,
    })
    .from(users)
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  return user === undefined ? null : toPublicUser(user);
}
