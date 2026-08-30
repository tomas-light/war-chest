import type { PublicUser } from '@war-chest/api-contracts';
import type { FakeUser } from '@war-chest/fake-database';

export function createFakePublicUser(user: FakeUser): PublicUser {
  return {
    avatarVersion:
      user.avatarDataUrl ??
      (user.avatarPresetId === null ? null : `preset:${user.avatarPresetId}`),
    displayName: user.displayName,
    id: user.id,
  };
}
