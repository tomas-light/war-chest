import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthError } from './errors.js';

interface OAuthState {
  codeVerifier: string;
  expiresAt: number;
  provider: OAuthProvider;
}

type OAuthProvider = 'telegram' | 'yandex';

export interface OAuthFlow {
  create(provider: OAuthProvider): {
    codeChallenge: string;
    state: string;
  };
  consume(provider: OAuthProvider, state: string, stateCookie: string): string;
}

export function createOAuthFlow(stateTtlMilliseconds: number): OAuthFlow {
  const oauthStates = new Map<string, OAuthState>();

  return { create, consume };

  function create(provider: OAuthProvider): {
    codeChallenge: string;
    state: string;
  } {
    removeExpiredStates();

    const state = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    oauthStates.set(state, {
      codeVerifier,
      expiresAt: Date.now() + stateTtlMilliseconds,
      provider,
    });

    return { codeChallenge, state };
  }

  function consume(
    provider: OAuthProvider,
    state: string,
    stateCookie: string
  ): string {
    const oauthState = oauthStates.get(state);

    oauthStates.delete(state);

    if (
      oauthState === undefined ||
      oauthState.provider !== provider ||
      oauthState.expiresAt <= Date.now() ||
      !areEqualSecrets(state, stateCookie)
    ) {
      throw new AuthError(
        'invalid_oauth_state',
        'OAuth state is invalid or has expired'
      );
    }

    return oauthState.codeVerifier;
  }

  function removeExpiredStates(): void {
    const currentTime = Date.now();

    for (const [state, oauthState] of oauthStates) {
      if (oauthState.expiresAt <= currentTime) {
        oauthStates.delete(state);
      }
    }
  }
}

function areEqualSecrets(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
