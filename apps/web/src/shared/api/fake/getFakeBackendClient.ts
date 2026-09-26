import {
  type FakeBackendClient,
  createFakeBackendClient,
} from './createFakeBackendClient';

let fakeBackendClient: FakeBackendClient | undefined;

export function getFakeBackendClient(): FakeBackendClient {
  fakeBackendClient ??= createFakeBackendClient();

  return fakeBackendClient;
}
