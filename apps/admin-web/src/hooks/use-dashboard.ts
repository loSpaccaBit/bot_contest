'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';
import type { DashboardMetricsDto } from '@domusbet/shared-types';

export const DASHBOARD_QUERY_KEY = ['dashboard', 'metrics'] as const;

export function useDashboardMetrics() {
  return useQuery<DashboardMetricsDto>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dashboardApi.getMetrics(),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
