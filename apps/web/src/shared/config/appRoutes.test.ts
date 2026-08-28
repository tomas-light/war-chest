import { expect, test } from 'vitest';
import { appRoutes } from './appRoutes';

test.each([
  ['login', appRoutes.login.url(), '/login'],
  ['lobby', appRoutes.lobby.url(), '/lobby'],
  ['new game', appRoutes.games.new.url(), '/games/new'],
  ['active game', appRoutes.games.gameId().url(), '/games/:gameId'],
  ['game board', appRoutes.games.play.gameId().url(), '/games/play/:gameId'],
  ['profile', appRoutes.profile.url(), '/profile'],
  ['user profile', appRoutes.users.userId().url(), '/users/:userId'],
  ['game history', appRoutes.history.gameId().url(), '/history/:gameId'],
])('builds the %s route', (_routeName, actualUrl, expectedUrl) => {
  expect(actualUrl).toBe(expectedUrl);
});
