import { type GameApi, createRealGameApi } from './GameApi';

export async function createSelectedGameApi(): Promise<GameApi> {
  if (import.meta.env.DEV) {
    const { readDevBackend } = await import('../config/backendKind');

    if (readDevBackend() === 'fake') {
      const { createFakeGameApiClient } =
        await import('./createFakeGameApiClient');

      return createFakeGameApiClient();
    }
  }

  return createRealGameApi();
}
