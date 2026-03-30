import type { PaginationQuery } from './pagination.types';

export interface ScoreRuleDto {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  points: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScoreRuleDto {
  code: string;
  name: string;
  description?: string;
  points: number;
  isActive?: boolean;
}

export interface UpdateScoreRuleDto {
  name?: string;
  description?: string;
  points?: number;
  isActive?: boolean;
}

export interface ScoreMovementDto {
  id: string;
  referrerId: string;
  referrerFirstName?: string | null;
  referrerTelegramUsername?: string | null;
  submissionId?: string | null;
  submissionDomusbetUsername?: string | null;
  scoreRuleId?: string | null;
  scoreRuleCode?: string | null;
  scoreRuleName?: string | null;
  adminId?: string | null;
  adminDisplayName?: string | null;
  points: number;
  reason?: string | null;
  createdAt: Date;
}

export interface ScoreMovementFiltersDto extends PaginationQuery {
  referrerId?: string;
  submissionId?: string;
  scoreRuleCode?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
}

export interface ReferrerScoreSummaryDto {
  referrerId: string;
  totalPoints: number;
  movementCount: number;
  lastMovementAt?: Date | null;
}
