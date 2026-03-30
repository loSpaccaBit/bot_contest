'use client';

import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { useReferrers } from '@/hooks/use-referrers';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { formatDate, formatPoints } from '@/lib/utils';
import type { ReferrerDto, ReferrerFiltersDto } from '@domusbet/shared-types';

const columns: ColumnDef<ReferrerDto>[] = [
  {
    accessorKey: 'firstName',
    header: 'Nome',
    cell: ({ row }) => {
      const { firstName, lastName, telegramUsername } = row.original;
      const name = [firstName, lastName].filter(Boolean).join(' ') || telegramUsername || '—';
      return <span className="font-medium text-slate-900">{name}</span>;
    },
  },
  {
    accessorKey: 'telegramId',
    header: 'Telegram ID',
    cell: ({ row }) => (
      <span className="font-mono text-xs text-slate-600">{row.original.telegramId}</span>
    ),
  },
  {
    accessorKey: 'totalPoints',
    header: 'Punti totali',
    cell: ({ row }) => (
      <span className="font-semibold text-blue-600">{formatPoints(row.original.totalPoints)}</span>
    ),
  },
  {
    accessorKey: 'approvedSubmissions',
    header: 'Segnalazioni',
    cell: ({ row }) => (
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-green-600 font-medium">{row.original.approvedSubmissions}</span>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">{row.original.totalSubmissions}</span>
      </div>
    ),
  },
  {
    accessorKey: 'isActive',
    header: 'Stato',
    cell: ({ row }) =>
      row.original.isActive ? (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Attivo</Badge>
      ) : (
        <Badge variant="outline" className="text-slate-500">Inattivo</Badge>
      ),
  },
  {
    accessorKey: 'rank',
    header: 'Rank',
    cell: ({ row }) => (
      <span className="text-slate-600">
        {row.original.rank != null ? `#${row.original.rank}` : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Registrato',
    cell: ({ row }) => (
      <span className="text-slate-500 text-sm">{formatDate(row.original.createdAt)}</span>
    ),
  },
];

export function ReferrersContent() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const filters: ReferrerFiltersDto = {
    page,
    limit: 20,
    search: search || undefined,
  };

  const { data, isLoading } = useReferrers(filters);

  return (
    <div className="space-y-6">
      <PageHeader title="Referrer" description="Lista di tutti i referrer registrati" />
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        searchPlaceholder="Cerca per username o nome..."
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
        emptyMessage="Nessun referrer trovato"
      />
    </div>
  );
}
