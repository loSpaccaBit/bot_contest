'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, X, SlidersHorizontal, Search } from 'lucide-react';
import { useSubmissions } from '@/hooks/use-submissions';
import { useReferrers } from '@/hooks/use-referrers';
import { useScoreRules } from '@/hooks/use-score-rules';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { SubmissionStatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate } from '@/lib/utils';
import type { SubmissionDto, SubmissionFiltersDto } from '@domusbet/shared-types';
import { SubmissionStatus } from '@domusbet/shared-types';

const columns: ColumnDef<SubmissionDto>[] = [
  {
    accessorKey: 'domusbetUsername',
    header: 'Username Domusbet',
    cell: ({ row }) => (
      <span className="font-medium text-slate-900">{row.original.domusbetUsername}</span>
    ),
  },
  {
    accessorKey: 'referrerFirstName',
    header: 'Referente',
    cell: ({ row }) => (
      <span className="text-slate-600">{row.original.referrerFirstName ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Stato',
    cell: ({ row }) => <SubmissionStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'totalPoints',
    header: 'Punti',
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.totalPoints != null && row.original.totalPoints > 0
          ? `${row.original.totalPoints} pt`
          : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'reviewedByName',
    header: 'Revisionato da',
    cell: ({ row }) => (
      <span className="text-slate-500 text-sm">{row.original.reviewedByName ?? '—'}</span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Data',
    cell: ({ row }) => (
      <span className="text-slate-500 text-sm">{formatDate(row.original.createdAt)}</span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: () => (
      <span className="flex justify-end">
        <Eye className="h-4 w-4 text-slate-400" />
      </span>
    ),
  },
];

const DEFAULT_STATUS = SubmissionStatus.PENDING;
const DEFAULT_SORT = 'createdAt_desc';

// ─── Hook: URL ↔ filtri ──────────────────────────────────────────────────────
function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = (key: string, fallback = '') => params.get(key) ?? fallback;

  const search = get('q');
  const status = (get('status', DEFAULT_STATUS)) as SubmissionStatus | 'ALL';
  const referrerId = get('ref', 'ALL');
  const dateFrom = get('from');
  const dateTo = get('to');
  const hasPoints = get('pts', 'ALL') as 'ALL' | 'true' | 'false';
  const scoreRuleCode = get('rule', 'ALL');
  const sortKey = get('sort', DEFAULT_SORT);
  const page = parseInt(get('page', '1'), 10);

  const set = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === 'ALL' || v === '' || v === DEFAULT_SORT) {
          next.delete(k);
        } else {
          next.set(k, v);
        }
      }
      // reset page whenever any filter changes (unless page itself is being set)
      if (!('page' in updates)) next.delete('page');
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  const activeCount = [
    status !== DEFAULT_STATUS && status !== 'ALL',
    referrerId !== 'ALL',
    dateFrom !== '',
    dateTo !== '',
    hasPoints !== 'ALL',
    scoreRuleCode !== 'ALL',
    sortKey !== DEFAULT_SORT,
  ].filter(Boolean).length;

  function reset() {
    router.replace(pathname);
  }

  return { search, status, referrerId, dateFrom, dateTo, hasPoints, scoreRuleCode, sortKey, page, set, reset, activeCount };
}

// ─── Componente principale ───────────────────────────────────────────────────
export function SubmissionsContent() {
  const router = useRouter();
  const fp = useFilterParams();

  const { data: referrersData } = useReferrers({ limit: 200 });
  const { data: scoreRules } = useScoreRules();

  const [sortBy, sortOrder] = fp.sortKey.split('_') as [string, 'asc' | 'desc'];

  const filters: SubmissionFiltersDto = {
    page: fp.page,
    limit: 20,
    search: fp.search || undefined,
    status: fp.status !== 'ALL' ? fp.status : undefined,
    referrerId: fp.referrerId !== 'ALL' ? fp.referrerId : undefined,
    dateFrom: fp.dateFrom || undefined,
    dateTo: fp.dateTo || undefined,
    hasPoints: fp.hasPoints !== 'ALL' ? fp.hasPoints === 'true' : undefined,
    scoreRuleCode: fp.scoreRuleCode !== 'ALL' ? fp.scoreRuleCode : undefined,
    sortBy: sortBy as SubmissionFiltersDto['sortBy'],
    sortOrder,
  };

  const { data, isLoading } = useSubmissions(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Segnalazioni"
        description="Gestisci le segnalazioni dei referrer"
      />

      {/* ── Filter panel ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header filtri */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
            Filtri
            {fp.activeCount > 0 && (
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs font-semibold">
                {fp.activeCount}
              </Badge>
            )}
          </div>
          {fp.activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={fp.reset}
              className="h-7 gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
              Azzera filtri
            </Button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Riga 1: Ricerca + Stato + Referente */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Ricerca
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Username Domusbet, nome..."
                  value={fp.search}
                  onChange={(e) => fp.set({ q: e.target.value })}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Stato
              </label>
              <Select value={fp.status} onValueChange={(v) => fp.set({ status: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tutti gli stati</SelectItem>
                  <SelectItem value={SubmissionStatus.PENDING}>In Attesa</SelectItem>
                  <SelectItem value={SubmissionStatus.APPROVED}>Approvate</SelectItem>
                  <SelectItem value={SubmissionStatus.REJECTED}>Rifiutate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Referente
              </label>
              <Select value={fp.referrerId} onValueChange={(v) => fp.set({ ref: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tutti i referenti</SelectItem>
                  {referrersData?.data.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.firstName ?? r.telegramUsername ?? r.telegramId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Riga 2: Date + Punti + Regola + Ordinamento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Dal
              </label>
              <Input
                type="date"
                value={fp.dateFrom}
                onChange={(e) => fp.set({ from: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Al
              </label>
              <Input
                type="date"
                value={fp.dateTo}
                onChange={(e) => fp.set({ to: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Punti
              </label>
              <Select
                value={fp.hasPoints}
                onValueChange={(v) => fp.set({ pts: v, rule: v !== 'true' ? 'ALL' : fp.scoreRuleCode })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tutti</SelectItem>
                  <SelectItem value="true">Con punti assegnati</SelectItem>
                  <SelectItem value="false">Senza punti</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Ordinamento
              </label>
              <Select value={fp.sortKey} onValueChange={(v) => fp.set({ sort: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt_desc">Data ↓ recenti</SelectItem>
                  <SelectItem value="createdAt_asc">Data ↑ meno recenti</SelectItem>
                  <SelectItem value="reviewedAt_desc">Revisione ↓ recente</SelectItem>
                  <SelectItem value="reviewedAt_asc">Revisione ↑ meno recente</SelectItem>
                  <SelectItem value="status_asc">Stato A→Z</SelectItem>
                  <SelectItem value="domusbetUsername_asc">Username A→Z</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Riga 3 (condizionale): Regola punteggio specifica */}
          {fp.hasPoints === 'true' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Regola punteggio
                </label>
                <Select value={fp.scoreRuleCode} onValueChange={(v) => fp.set({ rule: v })}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tutte le regole</SelectItem>
                    {scoreRules?.map((rule) => (
                      <SelectItem key={rule.id} value={rule.code}>
                        <span className="flex items-center gap-2">
                          {rule.name}
                          <Badge variant="outline" className="text-xs font-normal">
                            {rule.points} pt
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabella ───────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        pagination={
          data?.meta
            ? { ...data.meta, onPageChange: (p) => fp.set({ page: String(p) }) }
            : undefined
        }
        emptyMessage="Nessuna segnalazione trovata"
        onRowClick={(row) => router.push(`/submissions/${row.id}`)}
      />
    </div>
  );
}
