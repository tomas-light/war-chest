import { randomUUID } from 'node:crypto';
import { type AuthConfig, createAuth } from '@war-chest/auth';
import { type Database, emailLoginChallenges } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import * as schema from '../../../packages/database/src/schema/index.js';

const TEST_DATABASE_URL = process.env.WAR_CHEST_TEST_DATABASE_URL;
const AUTH_CONFIG: AuthConfig = {
  AUTH_COOKIE_SAME_SITE: 'lax',
  AUTH_COOKIE_SECURE: false,
  AUTH_EMAIL_CODE_HMAC_SECRET: 'test-secret-that-is-longer-than-32-characters',
  AUTH_EMAIL_CODE_IP_MAX_REQUESTS_PER_HOUR: 20,
  AUTH_EMAIL_CODE_MAX_FAILURES_PER_HOUR: 5,
  AUTH_EMAIL_CODE_MAX_REQUESTS_PER_HOUR: 5,
  AUTH_EMAIL_CODE_RESEND_DELAY_SECONDS: 60,
  AUTH_EMAIL_CODE_TTL_MINUTES: 10,
  AUTH_REGISTRATION_TICKET_TTL_MINUTES: 15,
  AUTH_SESSION_COOKIE_NAME: 'war_chest_session',
  AUTH_SESSION_TTL_MINUTES: 60,
};
const TEST_EMAIL = 'consumed-code-login@example.com';
const TEST_IP = '127.0.0.1';

const describeWithPostgreSql =
  TEST_DATABASE_URL === undefined ? describe.skip : describe;

describeWithPostgreSql('email code request limits', () => {
  let database: Database;
  let driver: Sql;
  let testSchemaName: string;

  beforeAll(async () => {
    const databaseUrl = requireTestDatabaseUrl(TEST_DATABASE_URL);

    driver = postgres(databaseUrl, { max: 1 });
    testSchemaName = `auth_rate_limits_${randomUUID().replaceAll('-', '')}`;
    await driver`create schema ${driver(testSchemaName)}`;
    await driver`set search_path to ${driver(testSchemaName)}`;
    await driver`
      create table email_login_challenges (
        id uuid primary key default gen_random_uuid(),
        email text not null,
        code_digest text not null,
        request_ip_hash text not null,
        expires_at timestamp with time zone not null,
        created_at timestamp with time zone not null default now(),
        consumed_at timestamp with time zone
      )
    `;
    database = drizzle(driver, { schema });
  });

  afterAll(async () => {
    await driver`drop schema ${driver(testSchemaName)} cascade`;
    await driver.end();
  });

  test('allows a new code immediately after the previous code was consumed', async () => {
    const sentCodes: string[] = [];
    const auth = createAuth({
      config: AUTH_CONFIG,
      database,
      emailCodeSender: { sendLoginCode },
    });

    await auth.requestEmailCode({ email: TEST_EMAIL, requestIp: TEST_IP });
    await database
      .update(emailLoginChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(emailLoginChallenges.email, TEST_EMAIL));
    await auth.requestEmailCode({ email: TEST_EMAIL, requestIp: TEST_IP });

    expect(sentCodes).toHaveLength(2);

    function sendLoginCode(input: { code: string }): Promise<void> {
      sentCodes.push(input.code);
      return Promise.resolve();
    }
  });
});

function requireTestDatabaseUrl(value: string | undefined): string {
  if (value === undefined) {
    throw new Error('WAR_CHEST_TEST_DATABASE_URL is required.');
  }

  const databaseName = new URL(value).pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    throw new Error('The integration database name must end with "_test".');
  }

  return value;
}
