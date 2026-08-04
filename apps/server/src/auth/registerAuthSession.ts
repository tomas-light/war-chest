import type { AuthSession } from '@war-chest/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    requireAuthSession(
      this: void,
      request: FastifyRequest,
      reply: FastifyReply
    ): Promise<void>;
  }

  interface FastifyRequest {
    authSession: AuthSession | null;
  }
}

export function registerAuthSession(app: FastifyInstance): void {
  const { auth } = app.serverDependencies;

  app.decorateRequest('authSession', null);
  app.decorate('requireAuthSession', requireAuthSession);

  async function requireAuthSession(
    this: void,
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    reply.header('Cache-Control', 'no-store');

    const sessionToken = request.cookies[auth.sessionCookieName];

    if (sessionToken === undefined) {
      sendUnauthorized(reply);
      return;
    }

    const session = await auth.getSession(sessionToken);

    if (session === null) {
      sendUnauthorized(reply);
      return;
    }

    request.authSession = session;
  }
}

function sendUnauthorized(reply: FastifyReply): void {
  void reply.code(401).send({
    error: {
      code: 'unauthorized',
      message: 'Authentication is required.',
    },
  });
}
