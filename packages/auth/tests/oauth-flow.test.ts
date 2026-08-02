import { afterEach, expect, test, vi } from 'vitest';
import { AuthError } from '../src/errors.js';
import { createOAuthFlow } from '../src/oauth-flow.js';

const OAUTH_STATE_TTL_MILLISECONDS = 10 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

test('creates one-time provider-bound OAuth state and PKCE values', () => {
  const oauthFlow = createOAuthFlow(OAUTH_STATE_TTL_MILLISECONDS);
  const authorization = oauthFlow.create('telegram');

  expect(authorization.state).toMatch(/^[\w-]{43}$/);
  expect(authorization.codeChallenge).toMatch(/^[\w-]{43}$/);
  expect(() =>
    oauthFlow.consume('yandex', authorization.state, authorization.state)
  ).toThrow(AuthError);
  expect(() =>
    oauthFlow.consume('telegram', authorization.state, authorization.state)
  ).toThrow(AuthError);
});

test('rejects expired OAuth state', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-28T12:00:00.000Z'));
  const oauthFlow = createOAuthFlow(OAUTH_STATE_TTL_MILLISECONDS);
  const authorization = oauthFlow.create('yandex');

  vi.advanceTimersByTime(OAUTH_STATE_TTL_MILLISECONDS);

  expect(() =>
    oauthFlow.consume('yandex', authorization.state, authorization.state)
  ).toThrow(AuthError);
});

test('rejects OAuth state from a different browser cookie', () => {
  const oauthFlow = createOAuthFlow(OAUTH_STATE_TTL_MILLISECONDS);
  const authorization = oauthFlow.create('telegram');

  expect(() =>
    oauthFlow.consume('telegram', authorization.state, 'different-state')
  ).toThrow(AuthError);
});
