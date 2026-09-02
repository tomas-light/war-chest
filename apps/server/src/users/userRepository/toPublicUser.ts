import { type PublicUser, createPublicUser } from '../PublicUser.js';

interface StoredPublicUser {
  avatarHash: string | null;
  avatarPresetId: string | null;
  displayName: string;
  id: string;
}

export function toPublicUser(user: StoredPublicUser): PublicUser {
  return createPublicUser({
    avatarVersion:
      user.avatarHash ??
      (user.avatarPresetId === null ? null : `preset:${user.avatarPresetId}`),
    displayName: user.displayName,
    id: user.id,
  });
}
