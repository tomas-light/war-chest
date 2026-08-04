import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import { AuthError } from '../errors.js';
import type { OAuthFlow } from '../OAuthFlow.js';
import {
  createBasicAuthorization,
  parseProviderResponse,
  requestJson,
} from './request.js';
import type { ProviderAuthorization, ProviderIdentity } from './types.js';

const telegramTokenResponseSchema = z.object({
  id_token: z.string().min(1),
});

const telegramClaimsSchema = z.object({
  given_name: z.string().optional(),
  name: z.string().optional(),
  picture: z.url().optional(),
  preferred_username: z.string().optional(),
  sub: z.string().min(1),
});

interface TelegramProvider {
  beginLogin(): ProviderAuthorization;
  completeLogin(
    code: string,
    state: string,
    stateCookie: string
  ): Promise<ProviderIdentity>;
}

interface CreateTelegramProviderOptions {
  authorizationEndpoint: string;
  clientId: string;
  clientSecret: string;
  issuer: string;
  jwksEndpoint: string;
  oauthFlow: OAuthFlow;
  redirectUri: string;
  tokenEndpoint: string;
}

export function createTelegramProvider(
  options: CreateTelegramProviderOptions
): TelegramProvider {
  const telegramJwks = createRemoteJWKSet(new URL(options.jwksEndpoint));

  return { beginLogin, completeLogin };

  function beginLogin(): ProviderAuthorization {
    assertConfigured(options);

    const { codeChallenge, state } = options.oauthFlow.create('telegram');
    const authorizationUrl = new URL(options.authorizationEndpoint);

    authorizationUrl.searchParams.set('client_id', options.clientId);
    authorizationUrl.searchParams.set('redirect_uri', options.redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'openid profile');
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
      'telegram',
      state,
      stateCookie
    );
    const tokenResponse = parseProviderResponse(
      telegramTokenResponseSchema,
      await requestJson(options.tokenEndpoint, {
        body: new URLSearchParams({
          client_id: options.clientId,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: options.redirectUri,
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

    try {
      const verification = await jwtVerify(
        tokenResponse.id_token,
        telegramJwks,
        {
          algorithms: ['RS256', 'ES256'],
          audience: options.clientId,
          issuer: options.issuer,
        }
      );
      const claims = telegramClaimsSchema.parse(verification.payload);

      return {
        avatarUrl: claims.picture,
        displayName:
          claims.name ??
          claims.given_name ??
          claims.preferred_username ??
          'Telegram user',
        provider: 'telegram',
        providerSubject: claims.sub,
      };
    } catch (error) {
      throw new AuthError(
        'invalid_credentials',
        'Telegram ID token is invalid',
        { cause: error }
      );
    }
  }
}

function assertConfigured(options: CreateTelegramProviderOptions): void {
  if (options.clientId.length === 0 || options.clientSecret.length === 0) {
    throw new AuthError(
      'provider_disabled',
      'Telegram authentication is not configured'
    );
  }
}
