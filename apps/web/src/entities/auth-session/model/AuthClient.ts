import type { SessionResponse } from '@war-chest/api-contracts';
import type { BackendKind } from '#/shared/config';

export type AuthProvider = 'google' | 'telegram' | 'yandex';

export interface AuthClient {
  readonly backend: BackendKind;
  getSession(this: void): Promise<SessionResponse | null>;
  login(
    this: void,
    provider: AuthProvider,
    idToken?: string
  ): Promise<SessionResponse | null>;
  logout(this: void): Promise<void>;
}
