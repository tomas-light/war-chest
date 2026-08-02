import { z } from 'zod';
import { AuthError } from '../errors.js';
import type { OAuthFlow } from '../oauth-flow.js';
import {
  createBasicAuthorization,
  parseProviderResponse,
  requestJson,
} from './request.js';
import type { ProviderAuthorization, ProviderIdentity } from './types.js';

const yandexTokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const yandexProfileSchema = z.object({
  client_id: z.string().min(1),
  default_avatar_id: z.string().optional(),
  display_name: z.string().optional(),
  id: z.string().min(1),
  is_avatar_empty: z.boolean().optional(),
  login: z.string().optional(),
  real_name: z.string().optional(),
});

interface YandexProvider {
  beginLogin(): ProviderAuthorization;
  completeLogin(
    code: string,
    state: string,
    stateCookie: string
  ): Promise<ProviderIdentity>;
}

interface CreateYandexProviderOptions {
  authorizationEndpoint: string;
  clientId: string;
  clientSecret: string;
  oauthFlow: OAuthFlow;
  profileEndpoint: string;
  redirectUri: string;
  tokenEndpoint: string;
}

export function createYandexProvider(
  options: CreateYandexProviderOptions
): YandexProvider {
  return { beginLogin, completeLogin };

  function beginLogin(): ProviderAuthorization {
    assertConfigured(options);

    const { codeChallenge, state } = options.oauthFlow.create('yandex');
    const authorizationUrl = new URL(options.authorizationEndpoint);

    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('client_id', options.clientId);
    authorizationUrl.searchParams.set('redirect_uri', options.redirectUri);
    authorizationUrl.searchParams.set('scope', 'login:info login:avatar');
    authorizationUrl.searchParams.set('state', state);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', 'S256');

    return { state, url: authorizationUrl.toString() };
  }

  async function completeLogin(
    code: string,
    state: string,
    stateCookie: string
  ): Promise<ProviderIdentity> {
    assertConfigured(options);

    const codeVerifier = options.oauthFlow.consume(
      'yandex',
      state,
      stateCookie
    );
    const tokenResponse = parseProviderResponse(
      yandexTokenResponseSchema,
      await requestJson(options.tokenEndpoint, {
        body: new URLSearchParams({
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
        }),
        headers: {
          authorization: createBasicAuthorization(
            options.clientId,
            options.clientSecret
          ),
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
      })
    );
    const profile = parseProviderResponse(
      yandexProfileSchema,
      await requestJson(options.profileEndpoint, {
        headers: {
          authorization: `OAuth ${tokenResponse.access_token}`,
        },
      })
    );

    if (profile.client_id !== options.clientId) {
      throw new AuthError(
        'invalid_credentials',
        'Yandex profile was issued for another client'
      );
    }

    return {
      avatarUrl: getAvatarUrl(profile),
      displayName:
        profile.display_name ??
        profile.real_name ??
        profile.login ??
        'Yandex user',
      provider: 'yandex',
      providerSubject: profile.id,
    };
  }
}

function getAvatarUrl(
  profile: z.infer<typeof yandexProfileSchema>
): string | undefined {
  if (
    profile.is_avatar_empty !== false ||
    profile.default_avatar_id === undefined
  ) {
    return undefined;
  }

  return `https://avatars.yandex.net/get-yapic/${encodeURIComponent(profile.default_avatar_id)}/islands-200`;
}

function assertConfigured(options: CreateYandexProviderOptions): void {
  if (options.clientId.length === 0 || options.clientSecret.length === 0) {
    throw new AuthError(
      'provider_disabled',
      'Yandex authentication is not configured'
    );
  }
}
