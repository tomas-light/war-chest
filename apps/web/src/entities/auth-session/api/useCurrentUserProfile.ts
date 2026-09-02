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
  const mutation = useMutation({ mutationFn: updateProfile });

  const removeAvatar = useCallback(
    () =>
      mutation.mutateAsync(
        async (authClient) => await authClient.removeAvatar()
      ),
    [mutation]
  );

  const selectAvatarPreset = useCallback(
    (presetId: AvatarPresetId) =>
      mutation.mutateAsync(
        async (authClient) => await authClient.selectAvatarPreset(presetId)
      ),
    [mutation]
  );

  const updateDisplayName = useCallback(
    (displayName: string) =>
      mutation.mutateAsync(
        async (authClient) => await authClient.updateDisplayName(displayName)
      ),
    [mutation]
  );

  const uploadAvatar = useCallback(
    (file: File) =>
      mutation.mutateAsync(
        async (authClient) => await authClient.uploadAvatar(file)
      ),
    [mutation]
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
