import {
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    avatarPresetId: text('avatar_preset_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)]
);

export const userAvatars = pgTable('user_avatars', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: bytea('content').notNull(),
  contentType: text('content_type').notNull(),
  contentHash: text('content_hash').notNull(),
});

export const emailLoginChallenges = pgTable(
  'email_login_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    codeDigest: text('code_digest').notNull(),
    requestIpHash: text('request_ip_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (table) => [
    index('email_login_challenges_email_created_at_index').on(
      table.email,
      table.createdAt
    ),
    index('email_login_challenges_ip_created_at_index').on(
      table.requestIpHash,
      table.createdAt
    ),
    index('email_login_challenges_expires_at_index').on(table.expiresAt),
  ]
);

export const emailLoginFailures = pgTable(
  'email_login_failures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    requestIpHash: text('request_ip_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('email_login_failures_email_created_at_index').on(
      table.email,
      table.createdAt
    ),
    index('email_login_failures_ip_created_at_index').on(
      table.requestIpHash,
      table.createdAt
    ),
  ]
);

export const emailRegistrationTickets = pgTable(
  'email_registration_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('email_registration_tickets_token_hash_unique').on(
      table.tokenHash
    ),
    index('email_registration_tickets_expires_at_index').on(table.expiresAt),
  ]
);

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('auth_sessions_token_hash_unique').on(table.tokenHash),
    index('auth_sessions_user_id_index').on(table.userId),
    index('auth_sessions_expires_at_index').on(table.expiresAt),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserAvatar = typeof userAvatars.$inferSelect;
export type NewUserAvatar = typeof userAvatars.$inferInsert;
export type EmailLoginChallenge = typeof emailLoginChallenges.$inferSelect;
export type NewEmailLoginChallenge = typeof emailLoginChallenges.$inferInsert;
export type EmailLoginFailure = typeof emailLoginFailures.$inferSelect;
export type NewEmailLoginFailure = typeof emailLoginFailures.$inferInsert;
export type EmailRegistrationTicket =
  typeof emailRegistrationTickets.$inferSelect;
export type NewEmailRegistrationTicket =
  typeof emailRegistrationTickets.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
