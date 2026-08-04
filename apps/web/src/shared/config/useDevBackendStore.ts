import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type BackendKind, DEV_BACKEND_STORAGE_KEY } from './backendKind';

interface DevBackendState {
  backend: BackendKind;
  setBackend(this: void, backend: BackendKind): void;
}

export const useDevBackendStore = create<DevBackendState>()(
  persist(
    (set) => ({
      backend: 'real',
      setBackend(backend) {
        set({ backend });
      },
    }),
    { name: DEV_BACKEND_STORAGE_KEY }
  )
);
