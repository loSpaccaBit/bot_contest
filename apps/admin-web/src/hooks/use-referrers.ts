'use client';

import { useQuery } from '@tanstack/react-query';
import { referrersApi } from '@/lib/api';
import type { ReferrerFiltersDto } from '@domusbet/shared-types';

export const REFERRERS_KEY = ['referrers'] as const;

export function useReferrers(filters?: ReferrerFiltersDto) {
  return useQuery({
    queryKey: [...REFERRERS_KEY, filters],
    queryFn: () => referrersApi.getAll(filters),
    staleTime: 10_000,
  });
}

export function useReferrer(id: string) {
  return useQuery({
    queryKey: [...REFERRERS_KEY, id],
    queryFn: () => referrersApi.getById(id),
    enabled: Boolean(id),
  });
}
