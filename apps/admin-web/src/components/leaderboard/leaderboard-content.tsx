'use client';

import { useState } from 'react';
import { Trophy, Medal, RefreshCw, LayoutTemplate } from 'lucide-react';
import Link from 'next/link';
import { useLeaderboard } from '@/hooks/use-leaderboard';
import { PageHeader } from '@/components/common/page-header';
import { PageLoader } from '@/components/common/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatPoints, cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { LEADERBOARD_KEY } from '@/hooks/use-leaderboard';

const rankColors = ['text-yellow-500', 'text-slate-400', 'text-amber-700'];
const rankBgs = ['bg-yellow-50 border-yellow-200', 'bg-slate-50 border-slate-200', 'bg-amber-50 border-amber-200'];

export function LeaderboardContent() {
  const { data, isLoading, isFetching } = useLeaderboard({ limit: 50 });
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: LEADERBOARD_KEY });
  };

  if (isLoading) return <PageLoader />;

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classifica"
        description={
          data
            ? `${data.totalParticipants} partecipanti · aggiornata ${formatDate(data.generatedAt)}`
            : 'Classifica referrer per punti'
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
              Aggiorna
            </Button>
            <Button size="sm" asChild className="bg-blue-600 hover:bg-blue-700 text-white">
              <Link href="/leaderboard-template">
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Grafica Classifica
              </Link>
            </Button>
          </div>
        }
      />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Trophy className="h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">La classifica è vuota</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const name =
              [entry.firstName, entry.lastName].filter(Boolean).join(' ') ||
              entry.telegramUsername ||
              `@${entry.telegramId}`;
            const isTop3 = entry.rank <= 3;

            return (
              <Card
                key={entry.referrerId}
                className={cn(
                  'transition-shadow hover:shadow-sm',
                  isTop3 && rankBgs[entry.rank - 1]
                )}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  {/* Rank */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    {entry.rank <= 3 ? (
                      <Medal
                        className={cn(
                          'h-7 w-7',
                          rankColors[entry.rank - 1]
                        )}
                      />
                    ) : (
                      <span className="text-lg font-bold text-slate-400">#{entry.rank}</span>
                    )}
                  </div>

                  {/* Name & username */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{name}</p>
                    {entry.telegramUsername && (
                      <p className="text-xs text-slate-500 truncate">@{entry.telegramUsername}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right hidden sm:block">
                      <p className="text-slate-500 text-xs">Segnalazioni</p>
                      <p className="font-semibold text-slate-900">{entry.approvedSubmissions}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-xs">Punti</p>
                      <p className="font-bold text-blue-600 text-base">
                        {formatPoints(entry.totalPoints)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
