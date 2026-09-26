import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AvatarPresetId, PublicUser } from '@war-chest/api-contracts';
import { useCallback } from 'react';
import type { AuthClient } from '../model/AuthClient';
import { useAuthClient } from '../model/AuthClientProvider';
import { clearSessionScopedQueries } from './sessionQueryCache';
import { sessionQueryOptions } from './sessionQueryOptions';

interface CurrentUserProfile {
  removeAvatar(this: void): Promise<PublicUser>;
  selectAvatarPreset(this: void, presetId: AvatarPresetId): Promise<PublicUser>;
  updateDisplayName(this: void, displayName: string): Promise<PublicUser>;
  uploadAvatar(this: void, file: File): Promise<PublicUser>;
}

export function useCurrentUserProfile(): CurrentUserProfile {
  const authClientPromise = useAuthClient();
  const queryClient = useQueryClient();
  const sessionQuery = sessionQueryOptions(authClientPromise);
  const { mutateAsync: updateProfileAsync } = useMutation({
    mutationFn: updateProfile,
  });

  const removeAvatar = useCallback(
    () =>
      updateProfileAsync(async (authClient) => await authClient.removeAvatar()),
    [updateProfileAsync]
  );

  const selectAvatarPreset = useCallback(
    (presetId: AvatarPresetId) =>
      updateProfileAsync(
        async (authClient) => await authClient.selectAvatarPreset(presetId)
      ),
    [updateProfileAsync]
  );

  const updateDisplayName = useCallback(
    (displayName: string) =>
      updateProfileAsync(
        async (authClient) => await authClient.updateDisplayName(displayName)
      ),
    [updateProfileAsync]
  );

  const uploadAvatar = useCallback(
    (file: File) =>
      updateProfileAsync(
        async (authClient) => await authClient.uploadAvatar(file)
      ),
    [updateProfileAsync]
  );

  return {
    removeAvatar,
    selectAvatarPreset,
    updateDisplayName,
    uploadAvatar,
  };

  async function updateProfile(
    operation: (authClient: AuthClient) => Promise<PublicUser>
  ) {
    const authClient = await authClientPromise;

    const user = await operation(authClient);

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
