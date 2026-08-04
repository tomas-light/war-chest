import type { AuthCookie, AuthSession } from '@war-chest/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { type PublicUser, createPublicUser } from '../users/public-user.js';

interface SessionResponse {
  expiresAt: string;
  user: PublicUser;
}

export function registerAuthRoutes(app: FastifyInstance): void {
  const { auth } = app.serverDependencies;

  app.get('/auth/session', { preHandler: app.requireAuthSession }, getSession);
  app.post('/auth/logout', logout);

  function getSession(
    request: FastifyRequest,
    reply: FastifyReply
  ): SessionResponse {
    const session = requireResolvedSession(request);

    reply.header('Cache-Control', 'no-store');
    return {
      expiresAt: session.expiresAt.toISOString(),
      user: createPublicUser(session.user),
    };
  }

  async function logout(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    reply.header('Cache-Control', 'no-store');

    const sessionToken = request.cookies[auth.sessionCookieName] ?? '';
    const clearedCookie = await auth.logout(sessionToken);

    setAuthCookie(reply, clearedCookie);

    return reply.code(204).send();
  }
}

function setAuthCookie(reply: FastifyReply, cookie: AuthCookie): void {
  reply.setCookie(cookie.name, cookie.value, cookie.options);
}

function requireResolvedSession(request: FastifyRequest): AuthSession {
  if (request.authSession === null) {
    throw new Error('Auth session pre-handler did not resolve a session.');
  }

  return request.authSession;
}
