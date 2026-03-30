import type { Context } from 'telegraf';
import type { SessionContext } from 'telegraf/typings/session';
import type { MessageService } from '../services/message.service';
import type { SubmissionService } from '../services/submission.service';
import type { ApiClient } from './api.client';
import type pino from 'pino';

export interface SessionData {
  referrerId?: string;
  lastCommandAt?: number;
}

export interface ReferrerContext {
  id: string;
  telegramId: string;
  firstName?: string | null;
  telegramUsername?: string | null;
}

export interface BotContext extends SessionContext<SessionData> {
  apiClient: ApiClient;
  messageService: MessageService;
  submissionService: SubmissionService;
  logger: pino.Logger;
  referrer?: ReferrerContext;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface SyncReferrerRequest {
  telegramId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
}

export interface SyncReferrerResponse {
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubmissionRequest {
  domusbetUsername: string;
  telegramId: string;
  telegramUsername?: string;
  firstName?: string;
  lastName?: string;
}

export interface CreateSubmissionResponse {
  id: string;
  domusbetUsername: string;
  normalizedDomusbetUsername: string;
  status: string;
  referrerId: string;
  referrerTelegramId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferrerStatsResponse {
  id: string;
  telegramId: string;
  telegramUsername?: string | null;
  firstName?: string | null;
  totalPoints: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  rank?: number;
}

export interface LeaderboardEntry {
  rank: number;
  referrerId: string;
  telegramId: string;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  totalPoints: number;
  approvedSubmissions: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  generatedAt: string;
  totalParticipants: number;
}

export interface LeaderboardPositionResponse {
  rank: number;
  totalPoints: number;
  telegramId: string;
}

export interface BotMessageResponse {
  id: string;
  key: string;
  name: string;
  content: string;
  isActive: boolean;
}

export interface ApiErrorPayload {
  statusCode: number;
  message: string;
  error?: string;
}

export type DuplicateSubmissionError = ApiErrorPayload & {
  isDuplicate: true;
};
