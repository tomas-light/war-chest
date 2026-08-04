import { createNiceWebRoutes } from 'nice-web-routes';

export const appRoutes = createNiceWebRoutes({
  games: {
    gameId: () => ({}),
    new: {},
  },
  history: {
    gameId: () => ({}),
  },
  lobby: {},
  login: {},
  profile: {},
  users: {
    userId: () => ({}),
  },
});
