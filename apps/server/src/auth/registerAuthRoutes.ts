import {
  type ApiErrorCode,
  type EmailCodeRequestedResponse,
  type SessionResponse,
  type VerifyEmailCodeResponse,
  completeEmailRegistrationRequestSchema,
  requestEmailCodeRequestSchema,
  verifyEmailCodeRequestSchema,
} from '@war-chest/api-contracts';
import { type AuthCookie, type AuthSession, AuthError } from '@war-chest/auth';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createPublicUser } from '../users/PublicUser.js';

interface SendErrorInput {
  code: ApiErrorCode;
  message: string;
  reply: FastifyReply;
  statusCode: number;
}

export function registerAuthRoutes(app: FastifyInstance): void {
  const { auth } = app.serverDependencies;

  app.post('/auth/email/code', requestEmailCode);
  app.post('/auth/email/verify', verifyEmailCode);
  app.post('/auth/email/register', completeEmailRegistration);
  app.get('/auth/session', { preHandler: app.requireAuthSession }, getSession);
  app.post('/auth/logout', logout);

  async function requestEmailCode(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | EmailCodeRequestedResponse> {
    setNoStore(reply);
    const body = requestEmailCodeRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendError({
        code: 'invalid_request',
        message: 'A valid email address is required.',
        reply,
        statusCode: 400,
      });
    }

    try {
      const result = await auth.requestEmailCode({
        email: body.data.email,
        requestIp: request.ip,
      });

      return reply.code(202).send({
        expiresAt: result.expiresAt.toISOString(),
        resendAvailableAt: result.resendAvailableAt.toISOString(),
      });
    } catch (error) {
      return handleAuthError(error, reply);
    }
  }

  async function verifyEmailCode(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | VerifyEmailCodeResponse> {
    setNoStore(reply);
    const body = verifyEmailCodeRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendError({
        code: 'invalid_request',
        message: 'Email and a six-digit code are required.',
        reply,
        statusCode: 400,
      });
    }

    try {
      const result = await auth.verifyEmailCode({
        code: body.data.code,
        email: body.data.email,
        requestIp: request.ip,
      });

      if (result.status === 'registration_required') {
        return {
          expiresAt: result.expiresAt.toISOString(),
          registrationToken: result.registrationToken,
          status: result.status,
        };
      }

      setAuthCookie(reply, result.login.cookie);
      return {
        session: createSessionResponse(result.login.session),
        status: 'authenticated',
      };
    } catch (error) {
      return handleAuthError(error, reply);
    }
  }

  async function completeEmailRegistration(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<FastifyReply | SessionResponse> {
    setNoStore(reply);
    const body = completeEmailRegistrationRequestSchema.safeParse(request.body);

    if (!body.success) {
      return sendError({
        code: 'invalid_request',
        message: 'A valid nickname and registration token are required.',
        reply,
        statusCode: 400,
      });
    }

    try {
      const result = await auth.completeEmailRegistration(body.data);

      setAuthCookie(reply, result.cookie);
      return createSessionResponse(result.session);
    } catch (error) {
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
    case 'email_code_invalid':
      return sendError({
        code: error.code,
        message: 'The code is invalid or expired.',
        reply,
        statusCode: 401,
      });
    case 'email_code_rate_limited':
      return sendError({
        code: error.code,
        message: 'Too many authentication attempts. Try again later.',
        reply,
        statusCode: 429,
      });
    case 'email_delivery_unavailable':
      return sendError({
        code: error.code,
        message: 'The login email could not be sent.',
        reply,
        statusCode: 503,
      });
    case 'registration_ticket_invalid':
      return sendError({
        code: error.code,
        message: 'Registration has expired. Request a new code.',
        reply,
        statusCode: 401,
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
