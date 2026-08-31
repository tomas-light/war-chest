import type {
  AvatarPresetId,
  EmailCodeRequestedResponse,
  PublicUser,
  SessionResponse,
  VerifyEmailCodeResponse,
} from '@war-chest/api-contracts';
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import {
  useCurrentUserProfile,
  useEmailAuthentication,
  useLogout,
  useSessionQuery,
} from '../api';

interface AuthSessionContextValue {
  backend: 'fake' | 'real' | null;
  completeEmailRegistration(
    this: void,
    registrationToken: string,
    displayName: string
  ): Promise<SessionResponse>;
  error: Error | null;
  logout(this: void): Promise<void>;
  removeAvatar(this: void): Promise<PublicUser>;
  requestEmailCode(
    this: void,
    email: string
  ): Promise<EmailCodeRequestedResponse>;
  selectAvatarPreset(this: void, presetId: AvatarPresetId): Promise<PublicUser>;
  refetch(this: void): Promise<void>;
  session: SessionResponse | null;
  status: 'anonymous' | 'authenticated' | 'error' | 'pending';
  updateDisplayName(this: void, displayName: string): Promise<PublicUser>;
  uploadAvatar(this: void, file: File): Promise<PublicUser>;
  verifyEmailCode(
    this: void,
    email: string,
    code: string
  ): Promise<VerifyEmailCodeResponse>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const sessionQuery = useSessionQuery();
  const emailAuthentication = useEmailAuthentication();
  const currentUserProfile = useCurrentUserProfile();
  const logout = useLogout();
  const refetchSession = sessionQuery.refetch;
  const refetch = useCallback(async () => {
    await refetchSession();
  }, [refetchSession]);
  const backend = sessionQuery.data?.backend ?? null;
  const error = sessionQuery.error;
  const session = sessionQuery.data?.session ?? null;
  const status = getSessionStatus(sessionQuery);
  const value = useMemo<AuthSessionContextValue>(
    () => ({
      backend,
      completeEmailRegistration: emailAuthentication.completeEmailRegistration,
      error,
      logout,
      removeAvatar: currentUserProfile.removeAvatar,
      refetch,
      requestEmailCode: emailAuthentication.requestEmailCode,
      selectAvatarPreset: currentUserProfile.selectAvatarPreset,
      session,
      status,
      updateDisplayName: currentUserProfile.updateDisplayName,
      uploadAvatar: currentUserProfile.uploadAvatar,
      verifyEmailCode: emailAuthentication.verifyEmailCode,
    }),
    [
      backend,
      currentUserProfile,
      emailAuthentication,
      error,
      logout,
      refetch,
      session,
      status,
    ]
  );

  return <AuthSessionContext value={value}>{children}</AuthSessionContext>;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);

  if (context === null) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider.');
  }

  return context;
}

function getSessionStatus(sessionQuery: {
  data: { session: SessionResponse | null } | undefined;
  isError: boolean;
  isPending: boolean;
}): AuthSessionContextValue['status'] {
  if (sessionQuery.isPending) {
    return 'pending';
  }

  if (sessionQuery.isError) {
    return 'error';
  }

  return sessionQuery.data?.session === null ? 'anonymous' : 'authenticated';
}
