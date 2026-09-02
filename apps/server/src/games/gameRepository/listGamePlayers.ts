import {
  type Database,
  gameParticipants,
  userAvatars,
  users,
} from '@war-chest/database';
import { asc, eq } from 'drizzle-orm';
import { createAvatarVersion } from './createAvatarVersion.js';
import type { StoredGamePlayer } from './GameRepositoryTypes.js';

export async function listGamePlayers(
  database: Database,
  gameId: string
): Promise<readonly StoredGamePlayer[]> {
  const players = await database
    .select({
      avatarHash: userAvatars.contentHash,
      avatarPresetId: users.avatarPresetId,
      displayName: users.displayName,
      id: users.id,
      seat: gameParticipants.seat,
      team: gameParticipants.team,
    })
    .from(gameParticipants)
    .innerJoin(users, eq(users.id, gameParticipants.userId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(eq(gameParticipants.gameId, gameId))
    .orderBy(asc(gameParticipants.team), asc(gameParticipants.seat));

  return players.map(({ avatarHash, avatarPresetId, ...player }) => ({
    ...player,
    avatarVersion: createAvatarVersion(avatarHash, avatarPresetId),
  }));
}
