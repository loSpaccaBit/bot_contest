import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle, XCircle, Star, FileText } from 'lucide-react';
import type { RecentActivityDto } from '@domusbet/shared-types';
import { formatDate } from '@/lib/utils';

interface RecentActivityProps {
  activities: RecentActivityDto[];
}

const activityConfig = {
  submission_created: { icon: FileText, color: 'text-blue-500', label: 'Nuova segnalazione' },
  submission_approved: { icon: CheckCircle, color: 'text-green-500', label: 'Approvata' },
  submission_rejected: { icon: XCircle, color: 'text-red-500', label: 'Rifiutata' },
  points_assigned: { icon: Star, color: 'text-yellow-500', label: 'Punti assegnati' },
};

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-slate-500" />
          Attività Recente
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">Nessuna attività recente</p>
        ) : (
          <ul className="space-y-3">
            {activities.slice(0, 8).map((activity) => {
              const config = activityConfig[activity.type];
              const Icon = config.icon;
              return (
                <li key={activity.id} className="flex items-start gap-3">
                  <div className={`mt-0.5 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700">
                      <span className="font-medium">{config.label}</span>
                      {activity.domusbetUsername && (
                        <span className="text-slate-500"> · @{activity.domusbetUsername}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">{formatDate(activity.timestamp)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
