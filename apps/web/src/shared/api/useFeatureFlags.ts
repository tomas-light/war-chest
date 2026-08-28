import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type { BackendKind } from '#/shared/config';
import { readFeatureFlags } from './readFeatureFlags';

export function useFeatureFlags(
  backend: BackendKind | null
): UseQueryResult<RuntimeFeatureFlags, Error> {
  return useQuery({
    enabled: backend !== null,
    queryFn: async () => {
      if (backend === null) {
        throw new Error('Backend is required to read runtime feature flags.');
      }

      return readFeatureFlags(backend);
    },
    queryKey: ['runtime-feature-flags', backend],
    refetchOnMount: 'always',
    staleTime: 0,
  });
}
