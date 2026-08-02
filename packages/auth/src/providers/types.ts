type AuthProviderName = 'google' | 'telegram' | 'yandex';

export interface ProviderIdentity {
  avatarUrl?: string;
  displayName: string;
  provider: AuthProviderName;
  providerSubject: string;
}

export interface ProviderAuthorization {
  state: string;
  url: string;
}
