import type { FastifyInstance } from 'fastify';
import { registerCreateGameRoute } from './gameRoutes/registerCreateGameRoute.js';
import { registerGetGameEventsRoute } from './gameRoutes/registerGetGameEventsRoute.js';
import { registerGetGameRoute } from './gameRoutes/registerGetGameRoute.js';
import { registerJoinGameRoute } from './gameRoutes/registerJoinGameRoute.js';
import { registerLeaveGameRoute } from './gameRoutes/registerLeaveGameRoute.js';
import { registerListGamesRoute } from './gameRoutes/registerListGamesRoute.js';
import { registerStartGameRoute } from './gameRoutes/registerStartGameRoute.js';
import { registerSurrenderGameRoute } from './gameRoutes/registerSurrenderGameRoute.js';
import { registerSwapPlayerPositionsRoute } from './gameRoutes/registerSwapPlayerPositionsRoute.js';

export function registerGameRoutes(app: FastifyInstance): void {
  registerListGamesRoute(app);
  registerCreateGameRoute(app);
  registerGetGameRoute(app);
  registerJoinGameRoute(app);
  registerLeaveGameRoute(app);
  registerStartGameRoute(app);
  registerSurrenderGameRoute(app);
  registerSwapPlayerPositionsRoute(app);
  registerGetGameEventsRoute(app);
}
