export const DEV_BACKEND_STORAGE_KEY = 'war-chest-dev-backend';

export type BackendKind = 'fake' | 'real';

export function readDevBackend(): BackendKind {
  if (!import.meta.env.DEV) {
    return 'real';
  }

  try {
    const storedValue: unknown = JSON.parse(
      window.localStorage.getItem(DEV_BACKEND_STORAGE_KEY) ?? 'null'
    );

    if (
      typeof storedValue === 'object' &&
      storedValue !== null &&
      'state' in storedValue &&
      typeof storedValue.state === 'object' &&
      storedValue.state !== null &&
      'backend' in storedValue.state &&
      storedValue.state.backend === 'fake'
    ) {
      return 'fake';
    }
  } catch {
    return 'real';
  }

  return 'real';
}
