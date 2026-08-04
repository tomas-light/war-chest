import fastifyCookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { API_PREFIX } from '@war-chest/api-contracts';
import type { Auth } from '@war-chest/auth';
import type { DatabaseConnection } from '@war-chest/database';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { registerAuthRoutes } from './auth/registerAuthRoutes.js';
import { registerAuthSession } from './auth/registerAuthSession.js';
import { createSocketServer } from './socket/createSocketServer.js';
import { registerUserRoutes } from './users/registerUserRoutes.js';
import {
  type UserRepository,
  createUserRepository,
} from './users/UserRepository.js';

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
  webAssetsRoot?: string;
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
  createSocketServer(app, options.auth);
  app.register(registerApiRoutes, { prefix: API_PREFIX });

  if (options.webAssetsRoot !== undefined) {
    registerWebApp(app, options.webAssetsRoot);
  }

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

  function registerApiRoutes(api: FastifyInstance): void {
    api.register(registerAuthRoutes);
    api.register(registerUserRoutes);
    api.get('/health', getHealth);
  }
}

function registerWebApp(app: FastifyInstance, webAssetsRoot: string): void {
  app.register(fastifyStatic, {
    immutable: true,
    index: false,
    maxAge: '30d',
    root: webAssetsRoot,
  });
  app.setNotFoundHandler(sendWebAppOrNotFound);

  function sendWebAppOrNotFound(
    request: FastifyRequest,
    reply: FastifyReply
  ): FastifyReply {
    const acceptsHtml = request.headers.accept?.includes('text/html') ?? false;
    const isNavigationRequest =
      (request.method === 'GET' || request.method === 'HEAD') && acceptsHtml;

    const isApiRequest =
      request.url === API_PREFIX || request.url.startsWith(`${API_PREFIX}/`);

    if (isApiRequest || !isNavigationRequest) {
      return reply.code(404).send({
        error: {
          code: 'not_found',
          message: 'Resource was not found.',
        },
      });
    }

    return reply
      .header('Cache-Control', 'no-cache')
      .sendFile('index.html', { cacheControl: false });
  }
}
