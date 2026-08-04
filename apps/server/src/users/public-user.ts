import type { AuthUser } from '@war-chest/auth';

export interface PublicUser {
  avatarVersion: string | null;
  displayName: string;
  id: string;
}

export function createPublicUser(user: AuthUser): PublicUser {
  return {
    avatarVersion: user.avatarHash,
    displayName: user.displayName,
    id: user.id,
  };
}
