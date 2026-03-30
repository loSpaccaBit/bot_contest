import type { PaginationQuery } from './pagination.types';

export interface ReferrerDto {
  id: string;
  telegramId: string;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  totalPoints: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  rank?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReferrerDto {
  telegramId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateReferrerDto {
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface ReferrerFiltersDto extends PaginationQuery {
  isActive?: boolean;
  telegramUsername?: string;
  search?: string;
}

export interface LeaderboardEntryDto {
  rank: number;
  referrerId: string;
  telegramId: string;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  totalPoints: number;
  approvedSubmissions: number;
}

export interface LeaderboardDto {
  entries: LeaderboardEntryDto[];
  generatedAt: Date;
  totalParticipants: number;
}
