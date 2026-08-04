import { OAuth2Client } from 'google-auth-library';
import { AuthError } from '../errors.js';
import type { ProviderIdentity } from './types.js';

interface GoogleProvider {
  verifyIdToken(idToken: string): Promise<ProviderIdentity>;
}

export function createGoogleProvider(clientId: string): GoogleProvider {
  const oauthClient = new OAuth2Client();

  return { verifyIdToken };

  async function verifyIdToken(idToken: string): Promise<ProviderIdentity> {
    assertConfigured(clientId, 'Google');

    try {
      const ticket = await oauthClient.verifyIdToken({
        audience: clientId,
        idToken,
      });
      const payload = ticket.getPayload();

      if (payload === undefined || payload.sub.length === 0) {
        throw new AuthError(
          'invalid_credentials',
          'Google ID token does not contain a subject'
        );
      }

      return {
        avatarUrl: payload.picture,
        displayName: payload.name ?? payload.given_name ?? 'Google user',
        provider: 'google',
        providerSubject: payload.sub,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError('invalid_credentials', 'Google ID token is invalid', {
        cause: error,
      });
    }
  }
}

function assertConfigured(clientId: string, providerName: string): void {
  if (clientId.length === 0) {
    throw new AuthError(
      'provider_disabled',
      `${providerName} authentication is not configured`
    );
  }
}
