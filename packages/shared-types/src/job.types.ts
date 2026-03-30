import type { JobName } from './enums';

// Base job payload interface
export interface BaseJobPayload {
  jobId?: string;
  triggeredAt?: string;
  retryCount?: number;
}

// Notification job payloads
export interface SendApprovalNotificationPayload extends BaseJobPayload {
  job: JobName.SEND_APPROVAL_NOTIFICATION;
  telegramId: string;
  referrerId: string;
  firstName?: string | null;
  domusbetUsername: string;
  points: number;
  totalPoints: number;
  submissionId: string;
}

export interface SendRejectionNotificationPayload extends BaseJobPayload {
  job: JobName.SEND_REJECTION_NOTIFICATION;
  telegramId: string;
  firstName?: string | null;
  domusbetUsername: string;
  rejectionReason: string;
  submissionId: string;
}

// Leaderboard job payloads
export interface RecalcLeaderboardPayload extends BaseJobPayload {
  job: JobName.RECALC_LEADERBOARD;
  reason?: string;
  triggeredByAdminId?: string;
}

export interface ExportLeaderboardPayload extends BaseJobPayload {
  job: JobName.EXPORT_LEADERBOARD;
  format: 'csv' | 'json' | 'excel';
  includeAllReferrers?: boolean;
  topN?: number;
  requestedByAdminId?: string;
  deliverToTelegramId?: string;
}

// Union type for all job payloads
export type JobPayload =
  | SendApprovalNotificationPayload
  | SendRejectionNotificationPayload
  | RecalcLeaderboardPayload
  | ExportLeaderboardPayload;

// Job result types
export interface JobResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

export interface NotificationJobResult extends JobResult {
  telegramMessageId?: number;
  sent: boolean;
}
