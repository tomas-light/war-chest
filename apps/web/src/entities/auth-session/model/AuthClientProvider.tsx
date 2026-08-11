import {
  type PropsWithChildren,
  createContext,
  useContext,
  useState,
} from 'react';
import type { AuthClient } from './AuthClient';
import { createRealAuthClient } from './createRealAuthClient';

const AuthClientContext = createContext<Promise<AuthClient> | null>(null);

export function AuthClientProvider({ children }: PropsWithChildren) {
  const [authClientPromise] = useState<Promise<AuthClient>>(createAuthClient);

  return (
    <AuthClientContext value={authClientPromise}>{children}</AuthClientContext>
  );
}

export function useAuthClient(): Promise<AuthClient> {
  const authClientPromise = useContext(AuthClientContext);

  if (authClientPromise === null) {
    throw new Error('useAuthClient must be used inside AuthClientProvider.');
  }

  return authClientPromise;
}

async function createAuthClient(): Promise<AuthClient> {
  if (import.meta.env.DEV) {
    const { readDevBackend } = await import('#/shared/config/backendKind');

    if (readDevBackend() === 'fake') {
      const { createFakeAuthClient } = await import('./createFakeAuthClient');

      return createFakeAuthClient();
    }
  }

  return createRealAuthClient();
}
