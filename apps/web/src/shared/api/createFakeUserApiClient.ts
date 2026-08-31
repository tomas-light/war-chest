import { getFakeBackendClient } from './getFakeBackendClient';
import type { UserApi } from './UserApi';

export function createFakeUserApiClient(): UserApi {
  const client = getFakeBackendClient();

  return {
    getPublicUser: client.getPublicUser,
    listFinishedGames: client.listFinishedGames,
  };
}
