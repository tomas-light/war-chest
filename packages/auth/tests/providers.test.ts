import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterEach, expect, test, vi } from 'vitest';
import { createOAuthFlow } from '../src/oauth-flow.js';
import { createTelegramProvider } from '../src/providers/telegram.js';
import { createYandexProvider } from '../src/providers/yandex.js';

const OAUTH_STATE_TTL_MILLISECONDS = 10 * 60 * 1000;

afterEach(() => {
  vi.unstubAllGlobals();
});

test('builds Telegram authorization URL with state and PKCE S256', () => {
  const provider = createTelegramProvider({
    authorizationEndpoint: 'https://telegram.example/authorize',
    clientId: 'telegram-client',
    clientSecret: 'telegram-secret',
    issuer: 'https://telegram.example',
    jwksEndpoint: 'https://telegram.example/jwks',
    oauthFlow: createOAuthFlow(OAUTH_STATE_TTL_MILLISECONDS),
    redirectUri: 'http://localhost:3000/auth/telegram/callback',
    tokenEndpoint: 'https://telegram.example/token',
  });
  const authorizationUrl = new URL(provider.beginLogin().url);

  expect(authorizationUrl.origin).toBe('https://telegram.example');
  expect(authorizationUrl.pathname).toBe('/authorize');
  expect(authorizationUrl.searchParams.get('scope')).toBe('openid profile');
  expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe(
    'S256'
  );
  expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
  expect(authorizationUrl.searchParams.get('code_challenge')).toBeTruthy();
});

test('verifies Telegram ID token and normalizes its claims', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  const idToken = await new SignJWT({
    name: 'Telegram Player',
    picture: 'https://cdn4.telesco.pe/file/avatar',
    sub: 'telegram-user',
  })
    .setAudience('telegram-client')
    .setExpirationTime('5m')
    .setIssuedAt()
    .setIssuer('https://telegram.example')
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(privateKey);
  vi.stubGlobal('fetch', mockFetch);
  const provider = createTelegramProvider({
    authorizationEndpoint: 'https://telegram.example/authorize',
    clientId: 'telegram-client',
    clientSecret: 'telegram-secret',
    issuer: 'https://telegram.example',
    jwksEndpoint: 'https://telegram.example/jwks',
    oauthFlow: createOAuthFlow(OAUTH_STATE_TTL_MILLISECONDS),
    redirectUri: 'http://localhost:3000/auth/telegram/callback',
    tokenEndpoint: 'https://telegram.example/token',
  });
  const authorization = provider.beginLogin();
  const identity = await provider.completeLogin(
    'authorization-code',
    authorization.state,
    authorization.state
  );

  expect(identity).toEqual({
    avatarUrl: 'https://cdn4.telesco.pe/file/avatar',
    displayName: 'Telegram Player',
    provider: 'telegram',
    providerSubject: 'telegram-user',
  });

  function mockFetch(input: string | URL | Request): Promise<Response> {
    const url = getRequestUrl(input);

    if (url === 'https://telegram.example/token') {
      return Promise.resolve(Response.json({ id_token: idToken }));
    }

    expect(url).toBe('https://telegram.example/jwks');

    return Promise.resolve(
      Response.json({
        keys: [
          {
            ...publicJwk,
            alg: 'RS256',
            kid: 'test-key',
            use: 'sig',
          },
        ],
      })
    );
  }
});

test('builds Yandex authorization URL with state and PKCE S256', () => {
  const provider = createYandexProvider({
    authorizationEndpoint: 'https://yandex.example/authorize',
    clientId: 'yandex-client',
    clientSecret: 'yandex-secret',
    oauthFlow: createOAuthFlow(OAUTH_STATE_TTL_MILLISECONDS),
    profileEndpoint: 'https://yandex.example/profile',
    redirectUri: 'http://localhost:3000/auth/yandex/callback',
    tokenEndpoint: 'https://yandex.example/token',
  });
  const authorizationUrl = new URL(provider.beginLogin().url);

  expect(authorizationUrl.origin).toBe('https://yandex.example');
  expect(authorizationUrl.pathname).toBe('/authorize');
  expect(authorizationUrl.searchParams.get('scope')).toBe(
    'login:info login:avatar'
  );
  expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe(
    'S256'
  );
  expect(authorizationUrl.searchParams.get('state')).toBeTruthy();
  expect(authorizationUrl.searchParams.get('code_challenge')).toBeTruthy();
});

test('exchanges Yandex code and normalizes the verified profile', async () => {
  const requests: Array<{
    request?: RequestInit;
    url: string;
  }> = [];
  vi.stubGlobal('fetch', mockFetch);
  const provider = createYandexProvider({
    authorizationEndpoint: 'https://yandex.example/authorize',
    clientId: 'yandex-client',
    clientSecret: 'yandex-secret',
    oauthFlow: createOAuthFlow(OAUTH_STATE_TTL_MILLISECONDS),
    profileEndpoint: 'https://yandex.example/profile',
    redirectUri: 'http://localhost:3000/auth/yandex/callback',
    tokenEndpoint: 'https://yandex.example/token',
  });
  const authorization = provider.beginLogin();
  const state = new URL(authorization.url).searchParams.get('state');

  expect(state).toBeTruthy();

  if (state === null) {
    throw new Error('Yandex authorization state is missing');
  }

  const identity = await provider.completeLogin(
    'authorization-code',
    state,
    state
  );

  expect(identity).toEqual({
    avatarUrl: 'https://avatars.yandex.net/get-yapic/avatar-id/islands-200',
    displayName: 'Player',
    provider: 'yandex',
    providerSubject: 'yandex-user',
  });
  expect(requests).toHaveLength(2);
  expect(new Headers(requests[0]?.request?.headers).get('authorization')).toBe(
    `Basic ${Buffer.from('yandex-client:yandex-secret').toString('base64')}`
  );

  const tokenBody = requests[0]?.request?.body;

  expect(tokenBody).toBeInstanceOf(URLSearchParams);

  if (!(tokenBody instanceof URLSearchParams)) {
    throw new Error('Yandex token request body is invalid');
  }

  expect(tokenBody.get('code')).toBe('authorization-code');
  expect(tokenBody.get('code_verifier')).toBeTruthy();

  function mockFetch(
    input: string | URL | Request,
    request?: RequestInit
  ): Promise<Response> {
    const url = getRequestUrl(input);

    requests.push({ request, url });

    if (url === 'https://yandex.example/token') {
      return Promise.resolve(Response.json({ access_token: 'access-token' }));
    }

    expect(url).toBe('https://yandex.example/profile');
    expect(request?.headers).toEqual({
      authorization: 'OAuth access-token',
    });

    return Promise.resolve(
      Response.json({
        client_id: 'yandex-client',
        default_avatar_id: 'avatar-id',
        display_name: 'Player',
        id: 'yandex-user',
        is_avatar_empty: false,
      })
    );
  }
});

function getRequestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
}
