import { type GameApi, createRealGameApi } from './GameApi';

interface Input {
  userId: string;
}

export async function createSelectedGameApi(input: Input): Promise<GameApi> {
  if (import.meta.env.DEV) {
    const { readDevBackend } = await import('../config/backendKind');

    if (readDevBackend() === 'fake') {
      const { createFakeGameApi } = await import('./createFakeGameApi');

      return createFakeGameApi(input.userId);
    }
  }

  return createRealGameApi();
}
