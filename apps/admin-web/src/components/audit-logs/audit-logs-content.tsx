'use client';

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useAuditLogs } from '@/hooks/use-audit-logs';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import type { AuditLogDto, AuditLogFiltersDto } from '@domusbet/shared-types';

const actionColors: Record<string, string> = {
  SUBMISSION_APPROVED: 'bg-green-100 text-green-800 border-green-200',
  SUBMISSION_REJECTED: 'bg-red-100 text-red-800 border-red-200',
  SUBMISSION_CREATED: 'bg-blue-100 text-blue-800 border-blue-200',
  ADMIN_LOGIN: 'bg-purple-100 text-purple-800 border-purple-200',
  ADMIN_LOGOUT: 'bg-slate-100 text-slate-700 border-slate-200',
  ADMIN_CREATED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  ADMIN_DELETED: 'bg-red-100 text-red-800 border-red-200',
};

const columns: ColumnDef<AuditLogDto>[] = [
  {
    accessorKey: 'action',
    header: 'Azione',
    cell: ({ row }) => {
      const colorClass = actionColors[row.original.action] ?? 'bg-slate-100 text-slate-700 border-slate-200';
      return (
        <Badge variant="outline" className={colorClass}>
          {row.original.action}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'adminDisplayName',
    header: 'Admin',
    cell: ({ row }) => (
      <div className="text-sm">
        <p className="font-medium text-slate-900">{row.original.adminDisplayName ?? 'Sistema'}</p>
        {row.original.adminEmail && (
          <p className="text-xs text-slate-500">{row.original.adminEmail}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'entityType',
    header: 'Entità',
    cell: ({ row }) => (
      <div className="text-sm">
        <span className="text-slate-700">{row.original.entityType}</span>
        {row.original.entityId && (
          <p className="font-mono text-xs text-slate-400 truncate max-w-[120px]">
            {row.original.entityId}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'ipAddress',
    header: 'IP',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-slate-500">{row.original.ipAddress ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Data',
    cell: ({ row }) => (
      <span className="text-slate-500 text-sm whitespace-nowrap">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
];

export function AuditLogsContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const filters: AuditLogFiltersDto = {
    page,
    limit: 25,
    action: search || undefined,
  };

  const { data, isLoading } = useAuditLogs(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Storico di tutte le azioni amministrative"
      />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Filtra per azione..."
        searchValue={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
        pagination={
          data?.meta
            ? { ...data.meta, onPageChange: setPage }
            : undefined
        }
        emptyMessage="Nessun log trovato"
      />
    </div>
  );
}
