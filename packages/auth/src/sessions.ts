import { createHash, randomBytes } from 'node:crypto';
import type { Database } from '@war-chest/database';
import { authSessions, userAvatars, users } from '@war-chest/database';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { AuthConfig } from './config/index.js';
import type { AuthUser } from './identities.js';

const MILLISECONDS_PER_MINUTE = 60 * 1000;

export interface AuthSession {
  expiresAt: Date;
  user: AuthUser;
}

export interface AuthCookie {
  name: string;
  options: {
    expires: Date;
    httpOnly: true;
    maxAge: number;
    path: string;
    sameSite: 'lax' | 'none' | 'strict';
    secure: boolean;
  };
  value: string;
}

export type SessionCookie = AuthCookie;

interface CreatedSession {
  cookie: SessionCookie;
  session: AuthSession;
}

export async function createSession(
  database: Database,
  user: AuthUser,
  config: AuthConfig,
  now: Date
): Promise<CreatedSession> {
  const sessionToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(
    now.getTime() + config.AUTH_SESSION_TTL_MINUTES * MILLISECONDS_PER_MINUTE
  );

  await database.insert(authSessions).values({
    expiresAt,
    tokenHash: hashSessionToken(sessionToken),
    userId: user.id,
  });

  return {
    cookie: createSessionCookie(config, sessionToken, expiresAt),
    session: { expiresAt, user },
  };
}

export async function findSession(
  database: Database,
  sessionToken: string,
  now: Date
): Promise<AuthSession | null> {
  const [session] = await database
    .select({
      avatarHash: userAvatars.contentHash,
      displayName: users.displayName,
      expiresAt: authSessions.expiresAt,
      userId: users.id,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, hashSessionToken(sessionToken)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, now)
      )
    )
    .limit(1);

  if (session === undefined) {
    return null;
  }

  return {
    expiresAt: session.expiresAt,
    user: {
      avatarHash: session.avatarHash,
      displayName: session.displayName,
      id: session.userId,
    },
  };
}

export async function revokeSession(
  database: Database,
  sessionToken: string,
  now: Date
): Promise<void> {
  await database
    .update(authSessions)
    .set({ revokedAt: now })
    .where(
      and(
        eq(authSessions.tokenHash, hashSessionToken(sessionToken)),
        isNull(authSessions.revokedAt)
      )
    );
}

export function createClearedSessionCookie(config: AuthConfig): SessionCookie {
  return createSessionCookie(config, '', new Date(0));
}

function createSessionCookie(
  config: AuthConfig,
  value: string,
  expiresAt: Date
): SessionCookie {
  return {
    name: config.AUTH_SESSION_COOKIE_NAME,
    options: {
      expires: expiresAt,
      httpOnly: true,
      maxAge: value.length === 0 ? 0 : config.AUTH_SESSION_TTL_MINUTES * 60,
      path: '/',
      sameSite: config.AUTH_COOKIE_SAME_SITE,
      secure: config.AUTH_COOKIE_SECURE,
    },
    value,
  };
}

function hashSessionToken(sessionToken: string): string {
  return createHash('sha256').update(sessionToken).digest('base64url');
}
