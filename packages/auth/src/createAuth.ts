import { createHash, createHmac, randomBytes, randomInt } from 'node:crypto';
import type { Database } from '@war-chest/database';
import {
  emailLoginChallenges,
  emailLoginFailures,
  emailRegistrationTickets,
  userAvatars,
  users,
} from '@war-chest/database';
import { and, count, desc, eq, gt, gte, isNull, or } from 'drizzle-orm';
import type { AuthUser } from './AuthUser.js';
import {
  type AuthConfig,
  type LoadAuthConfigOptions,
  loadAuthConfig,
} from './config/index.js';
import type { EmailCodeSender } from './EmailCodeSender.js';
import { AuthError } from './errors.js';
import {
  type AuthSession,
  type SessionCookie,
  createClearedSessionCookie,
  createSession,
  findSession,
  revokeSession,
} from './sessions.js';

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const EMAIL_CODE_UPPER_BOUND = 1_000_000;

export interface Auth {
  readonly sessionCookieName: string;
  completeEmailRegistration(
    input: CompleteRegistrationInput
  ): Promise<LoginResult>;
  getSession(sessionToken: string): Promise<AuthSession | null>;
  logout(sessionToken: string): Promise<SessionCookie>;
  requestEmailCode(
    input: EmailCodeRequestInput
  ): Promise<EmailCodeRequestResult>;
  verifyEmailCode(input: VerifyEmailCodeInput): Promise<VerifyEmailCodeResult>;
}

export interface CreateAuthOptions {
  config?: AuthConfig;
  configOptions?: LoadAuthConfigOptions;
  database: Database;
  emailCodeSender: EmailCodeSender;
}

export interface EmailCodeRequestInput {
  email: string;
  requestIp: string;
}

export interface EmailCodeRequestResult {
  expiresAt: Date;
  resendAvailableAt: Date;
}

export interface VerifyEmailCodeInput extends EmailCodeRequestInput {
  code: string;
}

export interface CompleteRegistrationInput {
  displayName: string;
  registrationToken: string;
}

export interface LoginResult {
  cookie: SessionCookie;
  session: AuthSession;
}

export type VerifyEmailCodeResult =
  | { login: LoginResult; status: 'authenticated' }
  | {
      expiresAt: Date;
      registrationToken: string;
      status: 'registration_required';
    };

export function createAuth(options: CreateAuthOptions): Auth {
  const config = options.config ?? loadAuthConfig(options.configOptions);

  return {
    completeEmailRegistration,
    getSession,
    logout,
    requestEmailCode,
    sessionCookieName: config.AUTH_SESSION_COOKIE_NAME,
    verifyEmailCode,
  };

  async function requestEmailCode(
    input: EmailCodeRequestInput
  ): Promise<EmailCodeRequestResult> {
    const now = new Date();
    const email = normalizeEmail(input.email);
    const requestIpHash = digestRequestIp(input.requestIp, config);
    await enforceRequestLimits({ email, now, requestIpHash });

    const code = randomInt(EMAIL_CODE_UPPER_BOUND).toString().padStart(6, '0');
    const expiresAt = new Date(
      now.getTime() +
        config.AUTH_EMAIL_CODE_TTL_MINUTES * MILLISECONDS_PER_MINUTE
    );
    const resendAvailableAt = new Date(
      now.getTime() + config.AUTH_EMAIL_CODE_RESEND_DELAY_SECONDS * 1000
    );
    const [challenge] = await options.database
      .insert(emailLoginChallenges)
      .values({
        codeDigest: digestEmailCode(email, code, config),
        email,
        expiresAt,
        requestIpHash,
      })
      .returning({ id: emailLoginChallenges.id });

    if (challenge === undefined) {
      throw new Error('Email login challenge was not created.');
    }

    try {
      await options.emailCodeSender.sendLoginCode({ code, email, expiresAt });
    } catch (error) {
      await options.database
        .delete(emailLoginChallenges)
        .where(eq(emailLoginChallenges.id, challenge.id));
      throw new AuthError(
        'email_delivery_unavailable',
        'The login email could not be sent.',
        { cause: error }
      );
    }

    return { expiresAt, resendAvailableAt };
  }

  async function verifyEmailCode(
    input: VerifyEmailCodeInput
  ): Promise<VerifyEmailCodeResult> {
    const now = new Date();
    const email = normalizeEmail(input.email);
    const requestIpHash = digestRequestIp(input.requestIp, config);
    await enforceFailureLimits({ email, now, requestIpHash });

    const codeDigest = digestEmailCode(email, input.code, config);
    const consumed = await options.database.transaction(async (transaction) => {
      const matches = await transaction
        .update(emailLoginChallenges)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailLoginChallenges.email, email),
            eq(emailLoginChallenges.codeDigest, codeDigest),
            gt(emailLoginChallenges.expiresAt, now),
            isNull(emailLoginChallenges.consumedAt)
          )
        )
        .returning({ id: emailLoginChallenges.id });

      if (matches.length === 0) {
        return false;
      }

      await transaction
        .update(emailLoginChallenges)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailLoginChallenges.email, email),
            isNull(emailLoginChallenges.consumedAt)
          )
        );
      await transaction
        .delete(emailLoginFailures)
        .where(eq(emailLoginFailures.email, email));
      return true;
    });

    if (!consumed) {
      await options.database
        .insert(emailLoginFailures)
        .values({ email, requestIpHash });
      throw new AuthError('email_code_invalid', 'The login code is invalid.');
    }

    const user = await findUserByEmail(email);

    if (user !== null) {
      return {
        login: await createSession({
          config,
          database: options.database,
          now,
          user,
        }),
        status: 'authenticated',
      };
    }

    const registrationToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      now.getTime() +
        config.AUTH_REGISTRATION_TICKET_TTL_MINUTES * MILLISECONDS_PER_MINUTE
    );
    await options.database.insert(emailRegistrationTickets).values({
      email,
      expiresAt,
      tokenHash: hashOpaqueToken(registrationToken),
    });

    return {
      expiresAt,
      registrationToken,
      status: 'registration_required',
    };
  }

  async function completeEmailRegistration(
    input: CompleteRegistrationInput
  ): Promise<LoginResult> {
    const now = new Date();
    const user = await options.database.transaction(async (transaction) => {
      const [ticket] = await transaction
        .update(emailRegistrationTickets)
        .set({ consumedAt: now })
        .where(
          and(
            eq(
              emailRegistrationTickets.tokenHash,
              hashOpaqueToken(input.registrationToken)
            ),
            gt(emailRegistrationTickets.expiresAt, now),
            isNull(emailRegistrationTickets.consumedAt)
          )
        )
        .returning({ email: emailRegistrationTickets.email });

      if (ticket === undefined) {
        return null;
      }

      const [createdUser] = await transaction
        .insert(users)
        .values({ displayName: input.displayName.trim(), email: ticket.email })
        .onConflictDoNothing({ target: users.email })
        .returning({
          avatarPresetId: users.avatarPresetId,
          displayName: users.displayName,
          id: users.id,
        });

      if (createdUser !== undefined) {
        return toAuthUser(createdUser, null);
      }

      const [existingUser] = await transaction
        .select({
          avatarHash: userAvatars.contentHash,
          avatarPresetId: users.avatarPresetId,
          displayName: users.displayName,
          id: users.id,
        })
        .from(users)
        .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
        .where(eq(users.email, ticket.email))
        .limit(1);

      return existingUser === undefined
        ? null
        : toAuthUser(existingUser, existingUser.avatarHash);
    });

    if (user === null) {
      throw new AuthError(
        'registration_ticket_invalid',
        'The registration ticket is invalid or expired.'
      );
    }

    return createSession({ config, database: options.database, now, user });
  }

  function getSession(sessionToken: string): Promise<AuthSession | null> {
    return findSession(options.database, sessionToken, new Date());
  }

  async function logout(sessionToken: string): Promise<SessionCookie> {
    await revokeSession(options.database, sessionToken, new Date());
    return createClearedSessionCookie(config);
  }

  async function findUserByEmail(email: string): Promise<AuthUser | null> {
    const [user] = await options.database
      .select({
        avatarHash: userAvatars.contentHash,
        avatarPresetId: users.avatarPresetId,
        displayName: users.displayName,
        id: users.id,
      })
      .from(users)
      .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
      .where(eq(users.email, email))
      .limit(1);

    return user === undefined ? null : toAuthUser(user, user.avatarHash);
  }

  async function enforceRequestLimits(input: {
    email: string;
    now: Date;
    requestIpHash: string;
  }): Promise<void> {
    const hourAgo = new Date(input.now.getTime() - MILLISECONDS_PER_HOUR);
    const resendThreshold = new Date(
      input.now.getTime() - config.AUTH_EMAIL_CODE_RESEND_DELAY_SECONDS * 1000
    );
    const [latestActiveChallenge] = await options.database
      .select({ createdAt: emailLoginChallenges.createdAt })
      .from(emailLoginChallenges)
      .where(
        and(
          eq(emailLoginChallenges.email, input.email),
          gt(emailLoginChallenges.expiresAt, input.now),
          isNull(emailLoginChallenges.consumedAt)
        )
      )
      .orderBy(desc(emailLoginChallenges.createdAt))
      .limit(1);
    const [emailCount, ipCount] = await Promise.all([
      countChallenges(eq(emailLoginChallenges.email, input.email), hourAgo),
      countChallenges(
        eq(emailLoginChallenges.requestIpHash, input.requestIpHash),
        hourAgo
      ),
    ]);

    if (
      (latestActiveChallenge !== undefined &&
        latestActiveChallenge.createdAt > resendThreshold) ||
      emailCount >= config.AUTH_EMAIL_CODE_MAX_REQUESTS_PER_HOUR ||
      ipCount >= config.AUTH_EMAIL_CODE_IP_MAX_REQUESTS_PER_HOUR
    ) {
      throw new AuthError(
        'email_code_rate_limited',
        'Too many login codes were requested.'
      );
    }
  }

  async function countChallenges(
    identityCondition: ReturnType<typeof eq>,
    since: Date
  ): Promise<number> {
    const [result] = await options.database
      .select({ value: count() })
      .from(emailLoginChallenges)
      .where(
        and(identityCondition, gte(emailLoginChallenges.createdAt, since))
      );
    return result?.value ?? 0;
  }

  async function enforceFailureLimits(input: {
    email: string;
    now: Date;
    requestIpHash: string;
  }): Promise<void> {
    const hourAgo = new Date(input.now.getTime() - MILLISECONDS_PER_HOUR);
    const [result] = await options.database
      .select({ value: count() })
      .from(emailLoginFailures)
      .where(
        and(
          gte(emailLoginFailures.createdAt, hourAgo),
          or(
            eq(emailLoginFailures.email, input.email),
            eq(emailLoginFailures.requestIpHash, input.requestIpHash)
          )
        )
      );

    if ((result?.value ?? 0) >= config.AUTH_EMAIL_CODE_MAX_FAILURES_PER_HOUR) {
      throw new AuthError(
        'email_code_rate_limited',
        'Too many invalid login codes were submitted.'
      );
    }
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function digestEmailCode(
  email: string,
  code: string,
  config: AuthConfig
): string {
  return createHmac('sha256', config.AUTH_EMAIL_CODE_HMAC_SECRET)
    .update(`${email}\0${code}`)
    .digest('base64url');
}

function digestRequestIp(requestIp: string, config: AuthConfig): string {
  return createHmac('sha256', config.AUTH_EMAIL_CODE_HMAC_SECRET)
    .update(requestIp)
    .digest('base64url');
}

function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

function toAuthUser(
  user: { avatarPresetId: string | null; displayName: string; id: string },
  avatarHash: string | null
): AuthUser {
  return {
    avatarVersion:
      avatarHash ??
      (user.avatarPresetId === null ? null : `preset:${user.avatarPresetId}`),
    displayName: user.displayName,
    id: user.id,
  };
}
