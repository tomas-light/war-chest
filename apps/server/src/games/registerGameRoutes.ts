import type { FastifyInstance } from 'fastify';
import { registerCompleteCardSelectionRoute } from './gameRoutes/registerCompleteCardSelectionRoute.js';
import { registerConfirmCardChoiceRoute } from './gameRoutes/registerConfirmCardChoiceRoute.js';
import { registerCreateGameRoute } from './gameRoutes/registerCreateGameRoute.js';
import { registerGetGameEventsRoute } from './gameRoutes/registerGetGameEventsRoute.js';
import { registerGetGameRoute } from './gameRoutes/registerGetGameRoute.js';
import { registerJoinGameRoute } from './gameRoutes/registerJoinGameRoute.js';
import { registerLeaveGameRoute } from './gameRoutes/registerLeaveGameRoute.js';
import { registerListGamesRoute } from './gameRoutes/registerListGamesRoute.js';
import { registerStartGameRoute } from './gameRoutes/registerStartGameRoute.js';
import { registerSurrenderGameRoute } from './gameRoutes/registerSurrenderGameRoute.js';
import { registerSwapPlayerPositionsRoute } from './gameRoutes/registerSwapPlayerPositionsRoute.js';
import { registerUpdateGameSettingsRoute } from './gameRoutes/registerUpdateGameSettingsRoute.js';

export function registerGameRoutes(app: FastifyInstance): void {
  registerCompleteCardSelectionRoute(app);
  registerConfirmCardChoiceRoute(app);
  registerListGamesRoute(app);
  registerCreateGameRoute(app);
  registerGetGameRoute(app);
  registerJoinGameRoute(app);
  registerLeaveGameRoute(app);
  registerStartGameRoute(app);
  registerSurrenderGameRoute(app);
  registerSwapPlayerPositionsRoute(app);
  registerUpdateGameSettingsRoute(app);
  registerGetGameEventsRoute(app);
}
