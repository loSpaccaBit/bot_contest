import axios, { AxiosInstance, AxiosError, isAxiosError } from 'axios';
import type pino from 'pino';
import type {
  SyncReferrerRequest,
  SyncReferrerResponse,
  CreateSubmissionRequest,
  CreateSubmissionResponse,
  ReferrerStatsResponse,
  LeaderboardResponse,
  LeaderboardPositionResponse,
  BotMessageResponse,
} from './api.types';

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 300;

function isNetworkError(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  // Retry on network errors or 5xx server errors (except 501)
  if (!err.response) return true;
  const status = err.response.status;
  return status >= 500 && status !== 501;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiClient {
  private readonly http: AxiosInstance;
  private readonly logger: pino.Logger;

  constructor(baseUrl: string, internalSecret: string, logger: pino.Logger) {
    this.logger = logger.child({ context: 'ApiClient' });
    this.http = axios.create({
      baseURL: `${baseUrl}/api`,
      timeout: 10_000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': internalSecret,
      },
    });

    // Unwrap the NestJS response envelope: { success: true, data: T, timestamp }
    this.http.interceptors.response.use((response) => {
      if (
        response.data &&
        typeof response.data === 'object' &&
        'success' in response.data &&
        'data' in response.data
      ) {
        response.data = response.data.data;
      }
      return response;
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async request<T>(
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    url: string,
    data?: unknown,
    params?: Record<string, unknown>,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        const response = await this.http.request<T>({
          method,
          url,
          data,
          params,
        });
        return response.data;
      } catch (err) {
        attempt++;
        const retriable = isNetworkError(err);

        if (retriable && attempt < MAX_RETRIES) {
          const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.warn(
            { url, attempt, delay },
            'Network error, retrying...',
          );
          await sleep(delay);
          continue;
        }

        // Re-throw so callers can inspect HTTP status
        throw err;
      }
    }
  }

  // ─── Referrer ────────────────────────────────────────────────────────────────

  /**
   * Upsert a referrer using their Telegram data.
   */
  async syncReferrer(data: SyncReferrerRequest): Promise<SyncReferrerResponse> {
    try {
      return await this.request<SyncReferrerResponse>(
        'post',
        '/internal/referrers/sync',
        data,
      );
    } catch (err) {
      this.logger.error({ err, telegramId: data.telegramId }, 'syncReferrer failed');
      throw err;
    }
  }

  /**
   * Get stats for a referrer by their Telegram ID.
   */
  async getReferrerStats(telegramId: string): Promise<ReferrerStatsResponse> {
    try {
      return await this.request<ReferrerStatsResponse>(
        'get',
        `/internal/referrers/${telegramId}/stats`,
      );
    } catch (err) {
      this.logger.error({ err, telegramId }, 'getReferrerStats failed');
      throw err;
    }
  }

  // ─── Submissions ─────────────────────────────────────────────────────────────

  /**
   * Create a new submission.
   * Throws with response.status === 409 when it's a duplicate.
   */
  async createSubmission(
    data: CreateSubmissionRequest,
  ): Promise<CreateSubmissionResponse> {
    try {
      return await this.request<CreateSubmissionResponse>(
        'post',
        '/internal/submissions',
        data,
      );
    } catch (err) {
      // Do NOT swallow 409 — callers need to detect duplicates
      if (isAxiosError(err) && err.response?.status === 409) {
        throw err;
      }
      this.logger.error(
        { err, domusbetUsername: data.domusbetUsername },
        'createSubmission failed',
      );
      throw err;
    }
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  /**
   * Fetch the leaderboard page.
   */
  async getLeaderboard(
    page = 1,
    limit = 10,
  ): Promise<LeaderboardResponse> {
    try {
      return await this.request<LeaderboardResponse>(
        'get',
        '/internal/leaderboard',
        undefined,
        { page, limit },
      );
    } catch (err) {
      this.logger.error({ err }, 'getLeaderboard failed');
      throw err;
    }
  }

  /**
   * Get a specific referrer's position on the leaderboard.
   */
  async getReferrerLeaderboardPosition(
    telegramId: string,
  ): Promise<LeaderboardPositionResponse | null> {
    try {
      return await this.request<LeaderboardPositionResponse>(
        'get',
        `/internal/leaderboard/position/${telegramId}`,
      );
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      this.logger.error({ err, telegramId }, 'getReferrerLeaderboardPosition failed');
      throw err;
    }
  }

  // ─── Bot messages ────────────────────────────────────────────────────────────

  /**
   * Asks the API to warm the Redis cache with all active bot message templates.
   */
  async warmBotMessageCache(): Promise<void> {
    await this.request<{ ok: boolean }>('get', '/internal/bot-messages/warm-cache');
  }

  /**
   * Fetch a bot message template by key.
   * Returns null when the key does not exist.
   */
  async getBotMessage(key: string): Promise<BotMessageResponse | null> {
    try {
      return await this.request<BotMessageResponse>(
        'get',
        `/internal/bot-messages/${key}`,
      );
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      this.logger.error({ err, key }, 'getBotMessage failed');
      throw err;
    }
  }

  // ─── Settings ────────────────────────────────────────────────────────────────

  /**
   * Fetch a set of system settings by their keys.
   * Returns a Record<key, value>.
   */
  async getSettings(keys: string[]): Promise<Record<string, string>> {
    try {
      return await this.request<Record<string, string>>(
        'get',
        '/internal/settings',
        undefined,
        { keys: keys.join(',') },
      );
    } catch (err) {
      this.logger.error({ err, keys }, 'getSettings failed');
      throw err;
    }
  }
}
