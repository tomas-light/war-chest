import type { Database } from '@war-chest/database';
import { userAvatars, userIdentities, users } from '@war-chest/database';
import { and, eq } from 'drizzle-orm';
import type { ProviderIdentity } from './providers/types.js';

export interface AuthUser {
  avatarHash: null | string;
  displayName: string;
  id: string;
}

class IdentityCreationConflict extends Error {}

export async function findOrCreateIdentity(
  database: Database,
  identity: ProviderIdentity
): Promise<AuthUser> {
  const existingUser = await findIdentity(database, identity);

  if (existingUser !== null) {
    if (existingUser.displayName === identity.displayName) {
      return existingUser;
    }

    const [updatedUser] = await database
      .update(users)
      .set({ displayName: identity.displayName })
      .where(eq(users.id, existingUser.id))
      .returning({
        displayName: users.displayName,
        id: users.id,
      });

    return {
      avatarHash: existingUser.avatarHash,
      displayName: updatedUser.displayName,
      id: updatedUser.id,
    };
  }

  try {
    return await database.transaction(async (transaction) => {
      const [createdUser] = await transaction
        .insert(users)
        .values({ displayName: identity.displayName })
        .returning({
          displayName: users.displayName,
          id: users.id,
        });
      const createdIdentities = await transaction
        .insert(userIdentities)
        .values({
          provider: identity.provider,
          providerSubject: identity.providerSubject,
          userId: createdUser.id,
        })
        .onConflictDoNothing({
          target: [userIdentities.provider, userIdentities.providerSubject],
        })
        .returning({ id: userIdentities.id });

      if (createdIdentities.length === 0) {
        throw new IdentityCreationConflict();
      }

      return {
        avatarHash: null,
        displayName: createdUser.displayName,
        id: createdUser.id,
      };
    });
  } catch (error) {
    if (error instanceof IdentityCreationConflict) {
      const concurrentlyCreatedUser = await findIdentity(database, identity);

      if (concurrentlyCreatedUser !== null) {
        return concurrentlyCreatedUser;
      }
    }

    throw error;
  }
}

async function findIdentity(
  database: Database,
  identity: ProviderIdentity
): Promise<AuthUser | null> {
  const [user] = await database
    .select({
      avatarHash: userAvatars.contentHash,
      displayName: users.displayName,
      id: users.id,
    })
    .from(userIdentities)
    .innerJoin(users, eq(users.id, userIdentities.userId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(
      and(
        eq(userIdentities.provider, identity.provider),
        eq(userIdentities.providerSubject, identity.providerSubject)
      )
    )
    .limit(1);

  return user ?? null;
}
