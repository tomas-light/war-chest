import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AvatarPresetId, PublicUser } from '@war-chest/api-contracts';
import { useCallback } from 'react';
import { useAuthClient } from '../model/AuthClientProvider';
import { clearSessionScopedQueries } from './sessionQueryCache';
import { sessionQueryOptions } from './sessionQueryOptions';

interface CurrentUserProfile {
  removeAvatar(this: void): Promise<PublicUser>;
  selectAvatarPreset(this: void, presetId: AvatarPresetId): Promise<PublicUser>;
  updateDisplayName(this: void, displayName: string): Promise<PublicUser>;
  uploadAvatar(this: void, file: File): Promise<PublicUser>;
}

type ProfileOperation =
  | { operation: 'removeAvatar' }
  | { operation: 'selectAvatarPreset'; presetId: AvatarPresetId }
  | { displayName: string; operation: 'updateDisplayName' }
  | { file: File; operation: 'uploadAvatar' };

export function useCurrentUserProfile(): CurrentUserProfile {
  const authClientPromise = useAuthClient();
  const queryClient = useQueryClient();
  const sessionQuery = sessionQueryOptions(authClientPromise);
  const mutation = useMutation({ mutationFn: mutateProfile });
  const removeAvatar = useCallback(
    () => mutation.mutateAsync({ operation: 'removeAvatar' }),
    [mutation]
  );
  const selectAvatarPreset = useCallback(
    (presetId: AvatarPresetId) =>
      mutation.mutateAsync({ operation: 'selectAvatarPreset', presetId }),
    [mutation]
  );
  const updateDisplayName = useCallback(
    (displayName: string) =>
      mutation.mutateAsync({ displayName, operation: 'updateDisplayName' }),
    [mutation]
  );
  const uploadAvatar = useCallback(
    (file: File) => mutation.mutateAsync({ file, operation: 'uploadAvatar' }),
    [mutation]
  );

  return {
    removeAvatar,
    selectAvatarPreset,
    updateDisplayName,
    uploadAvatar,
  };

  async function mutateProfile(
    operation: ProfileOperation
  ): Promise<PublicUser> {
    const authClient = await authClientPromise;
    let user: PublicUser;

    if (operation.operation === 'removeAvatar') {
      user = await authClient.removeAvatar();
    } else if (operation.operation === 'selectAvatarPreset') {
      user = await authClient.selectAvatarPreset(operation.presetId);
    } else if (operation.operation === 'updateDisplayName') {
      user = await authClient.updateDisplayName(operation.displayName);
    } else {
      user = await authClient.uploadAvatar(operation.file);
    }

    clearSessionScopedQueries(queryClient);
    queryClient.setQueryData(sessionQuery.queryKey, (current) =>
      current?.session === null || current === undefined
        ? current
        : {
            ...current,
            session: { ...current.session, user },
          }
    );
    return user;
  }
}
