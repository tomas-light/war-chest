import {
  type SessionResponse,
  API_PREFIX,
  googleLoginRequestSchema,
} from '@war-chest/api-contracts';
import { type AuthCookie, type AuthSession, AuthError } from '@war-chest/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { createPublicUser } from '../users/PublicUser.js';

type RedirectProvider = 'telegram' | 'yandex';

interface SendErrorInput {
  code: string;
  message: string;
  reply: FastifyReply;
  statusCode: number;
}

const oauthCallbackQuerySchema = z
  .object({
    code: z.string().trim().min(1),
    state: z.string().trim().min(1),
  })
  .strict();

export function registerAuthRoutes(app: FastifyInstance): void {
  const { auth } = app.serverDependencies;

  app.post('/auth/google', loginWithGoogle);
  app.get('/auth/telegram/start', beginTelegramLogin);
  app.get('/auth/telegram/callback', completeTelegramLogin);
  app.get('/auth/yandex/start', beginYandexLogin);
  app.get('/auth/yandex/callback', completeYandexLogin);
  app.get('/auth/session', { preHandler: app.requireAuthSession }, getSession);
  app.post('/auth/logout', logout);

  async function loginWithGoogle(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | SessionResponse> {
    setNoStore(reply);
    const requestResult = googleLoginRequestSchema.safeParse(request.body);

    if (!requestResult.success) {
      return sendError({
        code: 'invalid_request',
        message: 'Google ID token is required.',
        reply,
        statusCode: 400,
      });
    }

    try {
      const loginResult = await auth.loginWithGoogle(
        requestResult.data.idToken
      );

      setAuthCookie(reply, loginResult.cookie);
      return createSessionResponse(loginResult.session);
    } catch (error) {
      return handleAuthError(error, reply);
    }
  }

  async function beginTelegramLogin(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    return beginRedirectLogin(request, reply, 'telegram');
  }

  async function beginYandexLogin(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    return beginRedirectLogin(request, reply, 'yandex');
  }

  async function beginRedirectLogin(
    request: FastifyRequest,
    reply: FastifyReply,
    provider: RedirectProvider
  ): Promise<FastifyReply> {
    setNoStore(reply);

    try {
      const authorization =
        provider === 'telegram'
          ? auth.beginTelegramLogin()
          : auth.beginYandexLogin();

      setAuthCookie(reply, authorization.stateCookie);
      return reply.code(302).header('Location', authorization.url).send();
    } catch (error) {
      request.log.warn({ error, provider }, 'OAuth login could not be started');
      return handleAuthError(error, reply);
    }
  }

  async function completeTelegramLogin(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    return completeRedirectLogin(request, reply, 'telegram');
  }

  async function completeYandexLogin(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    return completeRedirectLogin(request, reply, 'yandex');
  }

  async function completeRedirectLogin(
    request: FastifyRequest,
    reply: FastifyReply,
    provider: RedirectProvider
  ): Promise<FastifyReply> {
    setNoStore(reply);
    const queryResult = oauthCallbackQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return sendError({
        code: 'invalid_request',
        message: 'OAuth callback parameters are invalid.',
        reply,
        statusCode: 400,
      });
    }

    const stateCookieName = `${auth.sessionCookieName}_${provider}_oauth_state`;
    const stateCookie = request.cookies[stateCookieName] ?? '';

    reply.clearCookie(stateCookieName, {
      path: `${API_PREFIX}/auth/${provider}/callback`,
    });

    try {
      const { code, state } = queryResult.data;
      const loginResult =
        provider === 'telegram'
          ? await auth.completeTelegramLogin(code, state, stateCookie)
          : await auth.completeYandexLogin(code, state, stateCookie);

      setAuthCookie(reply, loginResult.cookie);
      return reply.code(302).header('Location', auth.successRedirectUrl).send();
    } catch (error) {
      request.log.warn(
        { error, provider },
        'OAuth callback could not be completed'
      );
      return handleAuthError(error, reply);
    }
  }

  function getSession(
    request: FastifyRequest,
    reply: FastifyReply
  ): SessionResponse {
    const session = requireResolvedSession(request);

    setNoStore(reply);
    return createSessionResponse(session);
  }

  async function logout(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    setNoStore(reply);

    const sessionToken = request.cookies[auth.sessionCookieName] ?? '';
    const clearedCookie = await auth.logout(sessionToken);

    setAuthCookie(reply, clearedCookie);

    return reply.code(204).send();
  }
}

function createSessionResponse(session: AuthSession): SessionResponse {
  return {
    expiresAt: session.expiresAt.toISOString(),
    user: createPublicUser(session.user),
  };
}

function setAuthCookie(reply: FastifyReply, cookie: AuthCookie): void {
  reply.setCookie(cookie.name, cookie.value, cookie.options);
}

function handleAuthError(error: unknown, reply: FastifyReply): FastifyReply {
  if (!(error instanceof AuthError)) {
    throw error;
  }

  switch (error.code) {
    case 'invalid_credentials':
      return sendError({
        code: error.code,
        message: 'Provider credentials are invalid.',
        reply,
        statusCode: 401,
      });
    case 'invalid_oauth_state':
      return sendError({
        code: error.code,
        message: 'OAuth state is invalid or expired.',
        reply,
        statusCode: 400,
      });
    case 'provider_disabled':
      return sendError({
        code: error.code,
        message: 'The selected login provider is not configured.',
        reply,
        statusCode: 503,
      });
    case 'provider_request_failed':
      return sendError({
        code: error.code,
        message: 'The login provider request failed.',
        reply,
        statusCode: 502,
      });
  }
}

function sendError(input: SendErrorInput): FastifyReply {
  return input.reply
    .code(input.statusCode)
    .send({ error: { code: input.code, message: input.message } });
}

function setNoStore(reply: FastifyReply): void {
  reply.header('Cache-Control', 'no-store');
}

function requireResolvedSession(request: FastifyRequest): AuthSession {
  if (request.authSession === null) {
    throw new Error('Auth session pre-handler did not resolve a session.');
  }

  return request.authSession;
}
