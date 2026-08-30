import { type UserApi, createRealUserApi } from './UserApi';

export async function createSelectedUserApi(): Promise<UserApi> {
  if (import.meta.env.DEV) {
    const { readDevBackend } = await import('../config/backendKind');

    if (readDevBackend() === 'fake') {
      const { createFakeUserApiClient } =
        await import('./createFakeUserApiClient');

      return createFakeUserApiClient();
    }
  }

  return createRealUserApi();
}
