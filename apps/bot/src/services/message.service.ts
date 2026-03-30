import type { ApiClient } from '../api/api.client';
import type pino from 'pino';
import type Redis from 'ioredis';
import { BOT_MESSAGE_KEYS } from '@domusbet/shared-types';

const REDIS_KEY_PREFIX = 'bot:msg:';
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour fallback TTL (API refreshes on save)

/**
 * Renders a template string by replacing `{variableName}` placeholders.
 */
function renderTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = variables[key];
    // If no variable provided, escape the braces so MarkdownV2 doesn't choke
    return value !== undefined ? String(value) : match.replace(/[{}]/g, '\\$&');
  });
}

/**
 * Escapes a plain-text value so it is safe inside a MarkdownV2 message.
 */
function escapeMdV2(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

export class MessageService {
  private readonly logger: pino.Logger;

  constructor(
    private readonly apiClient: ApiClient,
    private readonly redis: Redis,
    logger: pino.Logger,
  ) {
    this.logger = logger.child({ context: 'MessageService' });
  }

  // ─── Core ──────────────────────────────────────────────────────────────────

  /**
   * Fetches a message template from Redis (or API as fallback) and renders it.
   * Variable values are escaped for MarkdownV2 before substitution.
   */
  async getRenderedMessage(
    key: string,
    variables: Record<string, string | number> = {},
  ): Promise<string> {
    const template = await this.fetchTemplate(key);
    const escapedVars = Object.fromEntries(
      Object.entries(variables).map(([k, v]) => [k, escapeMdV2(String(v))]),
    );
    return renderTemplate(template, escapedVars);
  }

  private async fetchTemplate(key: string): Promise<string> {
    const redisKey = `${REDIS_KEY_PREFIX}${key}`;

    // 1. Redis hit
    try {
      const cached = await this.redis.get(redisKey);
      if (cached) {
        return cached;
      }
    } catch (err) {
      this.logger.warn({ err, key }, 'Redis read failed, falling back to API');
    }

    // 2. API fetch
    try {
      const response = await this.apiClient.getBotMessage(key);
      if (response?.isActive && response.content) {
        await this.redis.set(redisKey, response.content, 'EX', CACHE_TTL_SECONDS).catch(() => {});
        return response.content;
      }
    } catch (err) {
      this.logger.error({ err, key }, 'Failed to fetch bot message from API');
    }

    this.logger.error({ key }, 'Bot message not found in Redis or API');
    return '❗ Messaggio non disponibile\\.';
  }

  /**
   * Invalidates a single message key in Redis so next fetch pulls from API.
   */
  async invalidateCache(key: string): Promise<void> {
    await this.redis.del(`${REDIS_KEY_PREFIX}${key}`).catch(() => {});
  }

  // ─── Typed convenience methods ─────────────────────────────────────────────

  async getWelcomeMessage(vars: { firstName: string }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.WELCOME_MESSAGE, vars);
  }

  async getSubmissionReceivedMessage(vars: { domusbetUsername: string; firstName?: string }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.SUBMISSION_RECEIVED, vars);
  }

  async getDuplicateSubmissionMessage(vars: { domusbetUsername: string; firstName?: string }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.DUPLICATE_SUBMISSION, vars);
  }

  async getSubmissionApprovedMessage(vars: {
    domusbetUsername: string;
    points: number;
    totalPoints?: number;
    firstName?: string;
  }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.SUBMISSION_APPROVED, {
      domusbetUsername: vars.domusbetUsername,
      points: vars.points,
      totalPoints: vars.totalPoints ?? 0,
      firstName: vars.firstName ?? '',
    });
  }

  async getSubmissionRejectedMessage(vars: {
    domusbetUsername: string;
    rejectionReason: string;
    firstName?: string;
  }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.SUBMISSION_REJECTED, {
      domusbetUsername: vars.domusbetUsername,
      rejectionReason: vars.rejectionReason,
      firstName: vars.firstName ?? '',
    });
  }

  async getGenericErrorMessage(): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.GENERIC_ERROR);
  }

  async getHelpMessage(): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.HELP_MESSAGE);
  }

  async getLeaderboardPositionMessage(vars: { rank: number; totalPoints: number }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.LEADERBOARD_POSITION, vars);
  }

  async getLeaderboardDisabledMessage(): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.LEADERBOARD_DISABLED);
  }

  async getLeaderboardEmptyMessage(): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.LEADERBOARD_EMPTY);
  }

  async getInvalidUsernameMessage(vars: { username: string }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.INVALID_USERNAME, vars);
  }

  async getRateLimitMessage(vars: { maxRequests: number }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.RATE_LIMIT, vars);
  }

  async getMyStatsMessage(vars: {
    firstName: string;
    totalPoints: number;
    approvedSubmissions: number;
    pendingSubmissions: number;
    totalSubmissions?: number;
    rank?: number;
  }): Promise<string> {
    return this.getRenderedMessage(BOT_MESSAGE_KEYS.MY_STATS, {
      firstName: vars.firstName,
      totalPoints: vars.totalPoints,
      approvedSubmissions: vars.approvedSubmissions,
      pendingSubmissions: vars.pendingSubmissions,
      totalSubmissions: vars.totalSubmissions ?? 0,
      rank: vars.rank ?? 0,
    });
  }

  async getLeaderboardMessage(
    entries: Array<{ rank: number; firstName: string; points: number }>,
  ): Promise<string> {
    const entriesText = entries
      .map(({ rank, firstName, points }) => {
        const medal =
          rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}\\.`;
        return `${medal} *${escapeMdV2(firstName)}* — ${escapeMdV2(String(points))} punti`;
      })
      .join('\n');

    // `entriesText` is already valid MarkdownV2 — inject it raw (no double-escape)
    const template = await this.fetchTemplate(BOT_MESSAGE_KEYS.LEADERBOARD_MESSAGE);
    return template.replace('{entries}', entriesText);
  }
}
