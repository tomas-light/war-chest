import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  EmailCodeRequestedResponse,
  SessionResponse,
  VerifyEmailCodeResponse,
} from '@war-chest/api-contracts';
import { useCallback } from 'react';
import type { AuthClient } from '../model/AuthClient';
import { useAuthClient } from '../model/AuthClientProvider';
import { clearSessionScopedQueries } from './sessionQueryCache';
import { AUTH_SESSION_QUERY_KEY } from './sessionQueryOptions';

interface EmailAuthentication {
  completeEmailRegistration(
    this: void,
    registrationToken: string,
    displayName: string
  ): Promise<SessionResponse>;
  requestEmailCode(
    this: void,
    email: string
  ): Promise<EmailCodeRequestedResponse>;
  verifyEmailCode(
    this: void,
    email: string,
    code: string
  ): Promise<VerifyEmailCodeResponse>;
}

type AuthenticationResult =
  EmailCodeRequestedResponse | SessionResponse | VerifyEmailCodeResponse;

export function useEmailAuthentication(): EmailAuthentication {
  const authClientPromise = useAuthClient();
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: authenticate });

  const requestEmailCode = useCallback(
    async (email: string) =>
      mutation.mutateAsync(async (authClient) =>
        authClient.requestEmailCode(email)
      ) as Promise<EmailCodeRequestedResponse>,
    [mutation]
  );

  const verifyEmailCode = useCallback(
    async (email: string, code: string) =>
      mutation.mutateAsync(async (authClient) => {
        const result = await authClient.verifyEmailCode(email, code);

        if (result.status === 'authenticated') {
          saveSession(queryClient, authClient.backend, result.session);
        }

        return result;
      }) as Promise<VerifyEmailCodeResponse>,
    [mutation, queryClient]
  );

  const completeEmailRegistration = useCallback(
    async (registrationToken: string, displayName: string) =>
      mutation.mutateAsync(async (authClient) => {
        const session = await authClient.completeEmailRegistration(
          registrationToken,
          displayName
        );

        saveSession(queryClient, authClient.backend, session);
        return session;
      }) as Promise<SessionResponse>,
    [mutation, queryClient]
  );

  return {
    completeEmailRegistration,
    requestEmailCode,
    verifyEmailCode,
  };

  async function authenticate(
    operation: (authClient: AuthClient) => Promise<AuthenticationResult>
  ): Promise<AuthenticationResult> {
    const authClient = await authClientPromise;
    return operation(authClient);
  }
}

function saveSession(
  queryClient: QueryClient,
  backend: AuthClient['backend'],
  session: SessionResponse
): void {
  clearSessionScopedQueries(queryClient);
  queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, { backend, session });
}
