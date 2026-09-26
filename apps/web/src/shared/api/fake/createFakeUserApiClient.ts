import type { UserApi } from '../UserApi';
import { getFakeBackendClient } from './getFakeBackendClient';

export function createFakeUserApiClient(): UserApi {
  const client = getFakeBackendClient();

  return {
    getPublicUser: client.getPublicUser,
    listFinishedGames: client.listFinishedGames,
  };
}
