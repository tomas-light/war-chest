import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  EmailCodeRequestedResponse,
  SessionResponse,
  VerifyEmailCodeResponse,
} from '@war-chest/api-contracts';
import { useCallback } from 'react';
import { useAuthClient } from '../model/AuthClientProvider';
import { clearSessionScopedQueries } from './sessionQueryCache';
import { sessionQueryOptions } from './sessionQueryOptions';

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

type AuthenticationOperation =
  | { email: string; operation: 'request' }
  | { code: string; email: string; operation: 'verify' }
  | {
      displayName: string;
      operation: 'register';
      registrationToken: string;
    };

type AuthenticationResult =
  EmailCodeRequestedResponse | SessionResponse | VerifyEmailCodeResponse;

export function useEmailAuthentication(): EmailAuthentication {
  const authClientPromise = useAuthClient();
  const queryClient = useQueryClient();
  const sessionQuery = sessionQueryOptions(authClientPromise);
  const mutation = useMutation({ mutationFn: authenticate });
  const requestEmailCode = useCallback(
    async (email: string) =>
      mutation.mutateAsync({
        email,
        operation: 'request',
      }) as Promise<EmailCodeRequestedResponse>,
    [mutation]
  );
  const verifyEmailCode = useCallback(
    async (email: string, code: string) =>
      mutation.mutateAsync({
        code,
        email,
        operation: 'verify',
      }) as Promise<VerifyEmailCodeResponse>,
    [mutation]
  );
  const completeEmailRegistration = useCallback(
    async (registrationToken: string, displayName: string) =>
      mutation.mutateAsync({
        displayName,
        operation: 'register',
        registrationToken,
      }) as Promise<SessionResponse>,
    [mutation]
  );

  return {
    completeEmailRegistration,
    requestEmailCode,
    verifyEmailCode,
  };

  async function authenticate(
    operation: AuthenticationOperation
  ): Promise<AuthenticationResult> {
    const authClient = await authClientPromise;

    if (operation.operation === 'request') {
      return authClient.requestEmailCode(operation.email);
    }

    if (operation.operation === 'verify') {
      const result = await authClient.verifyEmailCode(
        operation.email,
        operation.code
      );

      if (result.status === 'authenticated') {
        saveSession(authClient.backend, result.session);
      }

      return result;
    }

    const session = await authClient.completeEmailRegistration(
      operation.registrationToken,
      operation.displayName
    );
    saveSession(authClient.backend, session);
    return session;
  }

  function saveSession(
    backend: 'fake' | 'real',
    session: SessionResponse
  ): void {
    clearSessionScopedQueries(queryClient);
    queryClient.setQueryData(sessionQuery.queryKey, { backend, session });
  }
}
