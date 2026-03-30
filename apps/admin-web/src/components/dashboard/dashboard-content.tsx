'use client';
import { useDashboardMetrics } from '@/hooks/use-dashboard';
import { PageHeader } from '@/components/common/page-header';
import { PageLoader } from '@/components/common/loading-spinner';
import { StatsCards } from './stats-cards';
import { TopReferrers } from './top-referrers';
import { RecentActivity } from './recent-activity';

export function DashboardContent() {
  const { data: metrics, isLoading } = useDashboardMetrics();

  if (isLoading || !metrics) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Panoramica del sistema referral" />
      <StatsCards metrics={metrics} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopReferrers referrers={metrics.topReferrers} />
        <RecentActivity activities={metrics.recentActivity} />
      </div>
    </div>
  );
}
