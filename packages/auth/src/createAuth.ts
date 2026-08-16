import type { Database } from '@war-chest/database';
import { findAvatar, updateProviderAvatar } from './avatars.js';
import {
  type AuthConfig,
  type LoadAuthConfigOptions,
  loadAuthConfig,
} from './config/index.js';
import { findOrCreateIdentity } from './identities.js';
import { createOAuthFlow } from './OAuthFlow.js';
import { createGoogleProvider } from './providers/createGoogleProvider.js';
import { createTelegramProvider } from './providers/createTelegramProvider.js';
import { createYandexProvider } from './providers/createYandexProvider.js';
import type { ProviderIdentity } from './providers/types.js';
import {
  type AuthCookie,
  type AuthSession,
  type SessionCookie,
  createClearedSessionCookie,
  createSession,
  findSession,
  revokeSession,
} from './sessions.js';

export interface Auth {
  readonly sessionCookieName: string;
  readonly successRedirectUrl: string;
  beginTelegramLogin(): OAuthAuthorization;
  beginYandexLogin(): OAuthAuthorization;
  completeTelegramLogin(
    code: string,
    state: string,
    stateCookie: string
  ): Promise<LoginResult>;
  completeYandexLogin(
    code: string,
    state: string,
    stateCookie: string
  ): Promise<LoginResult>;
  getAvatar(userId: string): ReturnType<typeof findAvatar>;
  getSession(sessionToken: string): Promise<AuthSession | null>;
  loginWithGoogle(idToken: string): Promise<LoginResult>;
  logout(sessionToken: string): Promise<SessionCookie>;
}

export interface CreateAuthOptions {
  config?: AuthConfig;
  configOptions?: LoadAuthConfigOptions;
  database: Database;
}

export interface LoginResult {
  cookie: SessionCookie;
  session: AuthSession;
}

export interface OAuthAuthorization {
  stateCookie: AuthCookie;
  url: string;
}

export function createAuth(options: CreateAuthOptions): Auth {
  const config = options.config ?? loadAuthConfig(options.configOptions);
  const oauthStateTtlSeconds = config.AUTH_OAUTH_STATE_TTL_MINUTES * 60;
  const oauthStateTtlMilliseconds = oauthStateTtlSeconds * 1000;
  const oauthFlow = createOAuthFlow(oauthStateTtlMilliseconds);
  const googleProvider = createGoogleProvider(config.GOOGLE_CLIENT_ID);
  const telegramProvider = createTelegramProvider({
    authorizationEndpoint: config.TELEGRAM_AUTHORIZATION_ENDPOINT,
    clientId: config.TELEGRAM_CLIENT_ID,
    clientSecret: config.TELEGRAM_CLIENT_SECRET,
    issuer: config.TELEGRAM_ISSUER,
    jwksEndpoint: config.TELEGRAM_JWKS_ENDPOINT,
    oauthFlow,
    redirectUri: config.TELEGRAM_REDIRECT_URI,
    tokenEndpoint: config.TELEGRAM_TOKEN_ENDPOINT,
  });
  const yandexProvider = createYandexProvider({
    authorizationEndpoint: config.YANDEX_AUTHORIZATION_ENDPOINT,
    clientId: config.YANDEX_CLIENT_ID,
    clientSecret: config.YANDEX_CLIENT_SECRET,
    oauthFlow,
    profileEndpoint: config.YANDEX_PROFILE_ENDPOINT,
    redirectUri: config.YANDEX_REDIRECT_URI,
    tokenEndpoint: config.YANDEX_TOKEN_ENDPOINT,
  });

  return {
    beginTelegramLogin,
    beginYandexLogin,
    completeTelegramLogin,
    completeYandexLogin,
    getAvatar,
    getSession,
    loginWithGoogle,
    logout,
    sessionCookieName: config.AUTH_SESSION_COOKIE_NAME,
    successRedirectUrl: config.AUTH_SUCCESS_REDIRECT_URL,
  };

  function beginTelegramLogin(): OAuthAuthorization {
    const authorization = telegramProvider.beginLogin();

    return {
      stateCookie: createOAuthStateCookie(
        'telegram',
        authorization.state,
        config.TELEGRAM_REDIRECT_URI
      ),
      url: authorization.url,
    };
  }

  function beginYandexLogin(): OAuthAuthorization {
    const authorization = yandexProvider.beginLogin();

    return {
      stateCookie: createOAuthStateCookie(
        'yandex',
        authorization.state,
        config.YANDEX_REDIRECT_URI
      ),
      url: authorization.url,
    };
  }

  async function loginWithGoogle(idToken: string): Promise<LoginResult> {
    return login(await googleProvider.verifyIdToken(idToken));
  }

  async function completeTelegramLogin(
    code: string,
    state: string,
    stateCookie: string
  ): Promise<LoginResult> {
    return login(
      await telegramProvider.completeLogin(code, state, stateCookie)
    );
  }

  async function completeYandexLogin(
    code: string,
    state: string,
    stateCookie: string
  ): Promise<LoginResult> {
    return login(await yandexProvider.completeLogin(code, state, stateCookie));
  }

  async function login(identity: ProviderIdentity): Promise<LoginResult> {
    const user = await findOrCreateIdentity(options.database, identity);
    const avatarHash = await updateProviderAvatar({
      avatarUrl: identity.avatarUrl,
      config,
      database: options.database,
      existingAvatarHash: user.avatarHash,
      userId: user.id,
    });

    return createSession({
      config,
      database: options.database,
      now: new Date(),
      user: {
        ...user,
        avatarHash: avatarHash ?? user.avatarHash,
      },
    });
  }

  function getSession(sessionToken: string): Promise<AuthSession | null> {
    return findSession(options.database, sessionToken, new Date());
  }

  async function logout(sessionToken: string): Promise<SessionCookie> {
    await revokeSession(options.database, sessionToken, new Date());
    return createClearedSessionCookie(config);
  }

  function getAvatar(userId: string): ReturnType<typeof findAvatar> {
    return findAvatar(options.database, userId);
  }

  function createOAuthStateCookie(
    provider: 'telegram' | 'yandex',
    state: string,
    redirectUri: string
  ): AuthCookie {
    const expiresAt = new Date(Date.now() + oauthStateTtlMilliseconds);

    return {
      name: `${config.AUTH_SESSION_COOKIE_NAME}_${provider}_oauth_state`,
      options: {
        expires: expiresAt,
        httpOnly: true,
        maxAge: oauthStateTtlSeconds,
        path: new URL(redirectUri).pathname,
        sameSite: 'lax',
        secure: config.AUTH_COOKIE_SECURE,
      },
      value: state,
    };
  }
}
