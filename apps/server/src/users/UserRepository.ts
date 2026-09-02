import type { AvatarPresetId } from '@war-chest/api-contracts';
import type { Database } from '@war-chest/database';
import type { PublicUser } from './PublicUser.js';
import { findAvatar as findStoredAvatar } from './userRepository/findAvatar.js';
import { findPublicUser as findStoredPublicUser } from './userRepository/findPublicUser.js';
import { listFinishedGames as listStoredFinishedGames } from './userRepository/listFinishedGames.js';
import { removeAvatar as removeStoredAvatar } from './userRepository/removeAvatar.js';
import { saveAvatar as saveStoredAvatar } from './userRepository/saveAvatar.js';
import { selectAvatarPreset as selectStoredAvatarPreset } from './userRepository/selectAvatarPreset.js';
import { updateDisplayName as updateStoredDisplayName } from './userRepository/updateDisplayName.js';
import type {
  CustomAvatar,
  StoredAvatar,
  UserGameCursor,
  UserGamePage,
  UserRepository,
} from './userRepository/UserRepositoryTypes.js';

export type {
  CustomAvatar,
  StoredAvatar,
  UserGameCursor,
  UserGamePage,
  UserRepository,
} from './userRepository/UserRepositoryTypes.js';

export function createUserRepository(database: Database): UserRepository {
  return {
    findAvatar,
    findPublicUser,
    listFinishedGames,
    removeAvatar,
    saveAvatar,
    selectAvatarPreset,
    updateDisplayName,
  };

  function findAvatar(userId: string): Promise<StoredAvatar | null> {
    return findStoredAvatar(database, userId);
  }

  function findPublicUser(userId: string): Promise<PublicUser | null> {
    return findStoredPublicUser(database, userId);
  }

  function listFinishedGames(
    userId: string,
    options: { cursor?: UserGameCursor; limit: number }
  ): Promise<UserGamePage> {
    return listStoredFinishedGames({
      cursor: options.cursor,
      database,
      limit: options.limit,
      userId,
    });
  }

  function removeAvatar(userId: string): Promise<PublicUser | null> {
    return removeStoredAvatar({ database, findPublicUser, userId });
  }

  function saveAvatar(
    userId: string,
    avatar: CustomAvatar
  ): Promise<PublicUser | null> {
    return saveStoredAvatar({ avatar, database, findPublicUser, userId });
  }

  function selectAvatarPreset(
    userId: string,
    presetId: AvatarPresetId
  ): Promise<PublicUser | null> {
    return selectStoredAvatarPreset({
      database,
      findPublicUser,
      presetId,
      userId,
    });
  }

  function updateDisplayName(
    userId: string,
    displayName: string
  ): Promise<PublicUser | null> {
    return updateStoredDisplayName({
      database,
      displayName,
      findPublicUser,
      userId,
    });
  }
}
