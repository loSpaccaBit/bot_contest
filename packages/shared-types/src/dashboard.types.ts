import type { LeaderboardEntryDto } from './referrer.types';
import type { SubmissionDto } from './submission.types';

export interface DashboardMetricsDto {
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  rejectedSubmissions: number;
  totalReferrers: number;
  activeReferrers: number;
  totalPointsAwarded: number;
  submissionsToday: number;
  submissionsThisWeek: number;
  submissionsThisMonth: number;
  topReferrers: LeaderboardEntryDto[];
  recentActivity: RecentActivityDto[];
}

export interface RecentActivityDto {
  id: string;
  type: 'submission_created' | 'submission_approved' | 'submission_rejected' | 'points_assigned';
  submissionId?: string;
  referrerId?: string;
  referrerFirstName?: string | null;
  domusbetUsername?: string;
  points?: number;
  timestamp: Date;
}

export interface DashboardStatsDto {
  submissionsOverTime: TimeSeriesDataPoint[];
  pointsOverTime: TimeSeriesDataPoint[];
  statusBreakdown: StatusBreakdownDto;
  topReferrers: LeaderboardEntryDto[];
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
}

export interface StatusBreakdownDto {
  pending: number;
  approved: number;
  rejected: number;
  pendingPercentage: number;
  approvedPercentage: number;
  rejectedPercentage: number;
}

export interface ExportLeaderboardDto {
  format: 'csv' | 'json' | 'excel';
  includeAllReferrers?: boolean;
  topN?: number;
}

export interface RecentSubmissionsDto {
  submissions: SubmissionDto[];
  totalPending: number;
}
