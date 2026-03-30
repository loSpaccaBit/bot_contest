'use client';

import { useQuery } from '@tanstack/react-query';
import { leaderboardApi } from '@/lib/api';
import type { PaginationQuery } from '@domusbet/shared-types';

export const LEADERBOARD_KEY = ['leaderboard'] as const;

export function useLeaderboard(query?: PaginationQuery) {
  return useQuery({
    queryKey: [...LEADERBOARD_KEY, query],
    queryFn: () => leaderboardApi.get(query),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
