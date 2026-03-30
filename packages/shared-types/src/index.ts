// Enums
export * from './enums';

// Pagination
export type { PaginationQuery, PaginatedResponse } from './pagination.types';

// Submissions
export type {
  CreateSubmissionDto,
  SubmissionDto,
  ApproveSubmissionDto,
  RejectSubmissionDto,
  AssignPointsDto,
  SubmissionFiltersDto,
  SubmissionEventDto,
  SubmissionWithEventsDto,
  SubmissionScoreMovementDto,
  BulkUpdateSubmissionsDto,
} from './submission.types';

// Referrers
export type {
  ReferrerDto,
  CreateReferrerDto,
  UpdateReferrerDto,
  ReferrerFiltersDto,
  LeaderboardEntryDto,
  LeaderboardDto,
} from './referrer.types';

// Admin
export type {
  LoginDto,
  TokensDto,
  RefreshTokenDto,
  AdminDto,
  CreateAdminDto,
  UpdateAdminDto,
  ChangePasswordDto,
  AdminFiltersDto,
  AuthenticatedAdminDto,
} from './admin.types';

// Scores
export type {
  ScoreRuleDto,
  CreateScoreRuleDto,
  UpdateScoreRuleDto,
  ScoreMovementDto,
  ScoreMovementFiltersDto,
  ReferrerScoreSummaryDto,
} from './score.types';

// Bot messages
export type {
  BotMessageTemplateDto,
  CreateBotMessageTemplateDto,
  UpdateBotMessageTemplateDto,
  BotMessageKey,
} from './bot-message.types';
export { BOT_MESSAGE_KEYS, BOT_MESSAGE_PLACEHOLDERS } from './bot-message.types';

// Settings
export type {
  SystemSettingDto,
  UpdateSystemSettingDto,
  BulkUpdateSettingsDto,
  SystemSettingKey,
} from './setting.types';
export { SYSTEM_SETTING_KEYS } from './setting.types';

// Audit logs
export type {
  AuditLogDto,
  AuditLogFiltersDto,
  CreateAuditLogDto,
} from './audit.types';

// Dashboard
export type {
  DashboardMetricsDto,
  RecentActivityDto,
  DashboardStatsDto,
  TimeSeriesDataPoint,
  StatusBreakdownDto,
  ExportLeaderboardDto,
  RecentSubmissionsDto,
} from './dashboard.types';

// Jobs
export type {
  BaseJobPayload,
  SendApprovalNotificationPayload,
  SendRejectionNotificationPayload,
  RecalcLeaderboardPayload,
  ExportLeaderboardPayload,
  JobPayload,
  JobResult,
  NotificationJobResult,
} from './job.types';
