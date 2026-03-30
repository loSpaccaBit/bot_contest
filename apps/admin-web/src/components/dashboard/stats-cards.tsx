import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Clock, CheckCircle, XCircle, Users, Star } from 'lucide-react';
import type { DashboardMetricsDto } from '@domusbet/shared-types';

interface StatsCardsProps {
  metrics: DashboardMetricsDto;
}

export function StatsCards({ metrics }: StatsCardsProps) {
  const stats = [
    {
      title: 'Totale Segnalazioni',
      value: metrics.totalSubmissions,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      description: `${metrics.submissionsToday} oggi`,
    },
    {
      title: 'In Attesa',
      value: metrics.pendingSubmissions,
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      description: 'Da verificare',
    },
    {
      title: 'Approvate',
      value: metrics.approvedSubmissions,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      description: `${metrics.submissionsThisWeek} questa settimana`,
    },
    {
      title: 'Rifiutate',
      value: metrics.rejectedSubmissions,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      description: 'Segnalazioni non valide',
    },
    {
      title: 'Referenti Attivi',
      value: metrics.activeReferrers,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      description: `${metrics.totalReferrers} totali`,
    },
    {
      title: 'Punti Assegnati',
      value: metrics.totalPointsAwarded,
      icon: Star,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      description: 'Totale cumulativo',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-slate-500">{stat.title}</CardTitle>
              <div className={`rounded-lg p-1.5 ${stat.bg}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold text-slate-900">{stat.value.toLocaleString('it-IT')}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
