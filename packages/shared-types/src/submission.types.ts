import type { SubmissionStatus, SubmissionEventType } from './enums';
import type { PaginationQuery } from './pagination.types';

export interface CreateSubmissionDto {
  domusbetUsername: string;
  referrerTelegramId: string;
}

export interface SubmissionDto {
  id: string;
  domusbetUsername: string;
  normalizedDomusbetUsername: string;
  status: SubmissionStatus;
  referrerId: string;
  referrerTelegramId?: string;
  referrerFirstName?: string | null;
  reviewedById?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: Date | null;
  adminNotes?: string | null;
  rejectionReason?: string | null;
  totalPoints?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApproveSubmissionDto {
  submissionId: string;
  adminNotes?: string;
  scoreRuleCode?: string;
}

export interface RejectSubmissionDto {
  submissionId: string;
  rejectionReason: string;
  adminNotes?: string;
}

export interface AssignPointsDto {
  submissionId: string;
  scoreRuleCode: string;
  customPoints?: number;
  reason?: string;
}

export interface SubmissionFiltersDto extends PaginationQuery {
  status?: SubmissionStatus;
  referrerId?: string;
  /** Fulltext search: normalizedDomusbetUsername, telegramUsername, firstName */
  search?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  hasPoints?: boolean;
  /** Filtra per regola di punteggio specifica (es. REGISTRATION, DEPOSIT) */
  scoreRuleCode?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'status' | 'domusbetUsername' | 'reviewedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface SubmissionEventDto {
  id: string;
  submissionId: string;
  eventType: SubmissionEventType;
  payload?: Record<string, unknown> | null;
  actorId?: string | null;
  actorType?: string | null;
  createdAt: Date;
}

export interface SubmissionScoreMovementDto {
  id: string;
  points: number;
  reason?: string | null;
  scoreRuleName?: string | null;
  scoreRuleCode?: string | null;
  createdAt: Date;
}

export interface SubmissionWithEventsDto extends SubmissionDto {
  events: SubmissionEventDto[];
  scoreMovements: SubmissionScoreMovementDto[];
}

export interface BulkUpdateSubmissionsDto {
  submissionIds: string[];
  status: SubmissionStatus;
  adminNotes?: string;
  rejectionReason?: string;
}
