import type { SessionResponse } from '@war-chest/api-contracts';
import {
  type PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { useLogin, useLogout, useSessionQuery } from '../api';
import type { AuthProvider } from './AuthClient';

interface AuthSessionContextValue {
  backend: 'fake' | 'real' | null;
  error: Error | null;
  login(
    this: void,
    provider: AuthProvider,
    idToken?: string
  ): Promise<SessionResponse | null>;
  logout(this: void): Promise<void>;
  refetch(this: void): Promise<void>;
  session: SessionResponse | null;
  status: 'anonymous' | 'authenticated' | 'error' | 'pending';
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const sessionQuery = useSessionQuery();
  const login = useLogin();
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
    () => ({ backend, error, login, logout, refetch, session, status }),
    [backend, error, login, logout, refetch, session, status]
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
