import { type Database, userAvatars } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { StoredAvatar } from './UserRepositoryTypes.js';

export async function findAvatar(
  database: Database,
  userId: string
): Promise<StoredAvatar | null> {
  const [avatar] = await database
    .select({
      content: userAvatars.content,
      contentHash: userAvatars.contentHash,
      contentType: userAvatars.contentType,
    })
    .from(userAvatars)
    .where(eq(userAvatars.userId, userId))
    .limit(1);

  return avatar ?? null;
}
