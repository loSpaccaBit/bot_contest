import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import type { LeaderboardEntryDto } from '@domusbet/shared-types';

interface TopReferrersProps {
  referrers: LeaderboardEntryDto[];
}

const medalColors = ['text-yellow-500', 'text-slate-400', 'text-amber-600'];

export function TopReferrers({ referrers }: TopReferrersProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Top Referenti
        </CardTitle>
      </CardHeader>
      <CardContent>
        {referrers.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Nessun dato disponibile</p>
        ) : (
          <ul className="space-y-2">
            {referrers.slice(0, 5).map((referrer, idx) => (
              <li key={referrer.referrerId} className="flex items-center gap-3">
                <span className={`w-6 text-center font-bold text-sm ${medalColors[idx] ?? 'text-slate-500'}`}>
                  #{idx + 1}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex-shrink-0">
                  {(referrer.firstName ?? 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {referrer.firstName ?? `@${referrer.telegramUsername}`}
                  </p>
                  <p className="text-xs text-slate-500">{referrer.approvedSubmissions} segnalazioni</p>
                </div>
                <span className="text-sm font-semibold text-blue-600">{referrer.totalPoints} pt</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
