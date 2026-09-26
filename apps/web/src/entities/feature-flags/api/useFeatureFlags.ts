import { useQuery } from '@tanstack/react-query';
import { readFeatureFlags, useTranslatedApiResult } from '#/shared/api';
import type { BackendKind } from '#/shared/config';

export function useFeatureFlags(backend: BackendKind | null) {
  const query = useQuery({
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

  return useTranslatedApiResult(query);
}
