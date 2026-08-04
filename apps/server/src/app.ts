import fastifyCookie from '@fastify/cookie';
import type { Auth } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { registerAuthRoutes } from './auth/auth-routes.js';
import { registerAuthSession } from './auth/auth-session.js';
import {
  type UserRepository,
  createUserRepository,
} from './users/user-repository.js';
import { registerUserRoutes } from './users/user-routes.js';

interface ServerDependencies {
  auth: Auth;
  databaseConnection: DatabaseConnection;
  userRepository: UserRepository;
}

interface CreateAppOptions {
  auth: Auth;
  databaseConnection: DatabaseConnection;
  logger?: boolean;
  userRepository?: UserRepository;
}

declare module 'fastify' {
  interface FastifyInstance {
    serverDependencies: ServerDependencies;
  }
}

export function createApp(options: CreateAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? true });
  const dependencies: ServerDependencies = {
    auth: options.auth,
    databaseConnection: options.databaseConnection,
    userRepository:
      options.userRepository ??
      createUserRepository(options.databaseConnection.database),
  };

  app.decorate('serverDependencies', dependencies);
  app.addHook('onClose', closeDatabaseConnection);
  app.register(fastifyCookie);
  registerAuthSession(app);
  app.register(registerAuthRoutes);
  app.register(registerUserRoutes);
  app.get('/health', getHealth);

  return app;

  async function closeDatabaseConnection(): Promise<void> {
    await dependencies.databaseConnection.close();
  }

  async function getHealth(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<unknown> {
    try {
      await dependencies.databaseConnection.checkConnection();

      return { status: 'ok' };
    } catch (error) {
      request.log.error({ error }, 'Database health check failed');

      return reply.code(503).send({ status: 'unavailable' });
    }
  }
}
