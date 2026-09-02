import type { AvatarPresetId } from '@war-chest/api-contracts';
import { type Database, userAvatars, users } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { StoredAvatar } from './UserRepositoryTypes.js';

export async function findAvatar(
  database: Database,
  userId: string
): Promise<StoredAvatar | null> {
  const [avatar] = await database
    .select({
      avatarPresetId: users.avatarPresetId,
      content: userAvatars.content,
      contentHash: userAvatars.contentHash,
      contentType: userAvatars.contentType,
    })
    .from(users)
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (avatar?.content !== null && avatar?.content !== undefined) {
    return {
      content: avatar.content,
      contentHash: requireAvatarValue(avatar.contentHash),
      contentType: requireAvatarValue(avatar.contentType),
      kind: 'custom',
    };
  }

  return avatar?.avatarPresetId === null || avatar === undefined
    ? null
    : { kind: 'preset', presetId: avatar.avatarPresetId as AvatarPresetId };
}

function requireAvatarValue(value: string | null): string {
  if (value === null) {
    throw new Error('Stored avatar is incomplete.');
  }

  return value;
}
