import type { FastifyInstance } from 'fastify';
import { registerGetFinishedGamesRoute } from './userRoutes/registerGetFinishedGamesRoute.js';
import { registerGetPublicUserRoute } from './userRoutes/registerGetPublicUserRoute.js';
import { registerGetUserAvatarRoute } from './userRoutes/registerGetUserAvatarRoute.js';
import { registerRemoveCurrentUserAvatarRoute } from './userRoutes/registerRemoveCurrentUserAvatarRoute.js';
import { registerSelectCurrentUserAvatarRoute } from './userRoutes/registerSelectCurrentUserAvatarRoute.js';
import { registerUpdateCurrentUserRoute } from './userRoutes/registerUpdateCurrentUserRoute.js';
import { registerUploadCurrentUserAvatarRoute } from './userRoutes/registerUploadCurrentUserAvatarRoute.js';

export function registerUserRoutes(app: FastifyInstance): void {
  registerUpdateCurrentUserRoute(app);
  registerUploadCurrentUserAvatarRoute(app);
  registerSelectCurrentUserAvatarRoute(app);
  registerRemoveCurrentUserAvatarRoute(app);
  registerGetPublicUserRoute(app);
  registerGetUserAvatarRoute(app);
  registerGetFinishedGamesRoute(app);
}
