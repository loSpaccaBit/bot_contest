'use client';

import { useQuery } from '@tanstack/react-query';
import { auditLogsApi } from '@/lib/api';
import type { AuditLogFiltersDto } from '@domusbet/shared-types';

export const AUDIT_LOGS_KEY = ['audit-logs'] as const;

export function useAuditLogs(filters?: AuditLogFiltersDto) {
  return useQuery({
    queryKey: [...AUDIT_LOGS_KEY, filters],
    queryFn: () => auditLogsApi.getAll(filters),
    staleTime: 10_000,
  });
}
