import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from '../api/api.types';
import type { ApiClient } from '../api/api.client';
import type pino from 'pino';

/**
 * On every update that has a Telegram user (ctx.from), this middleware
 * upserts the referrer in the database and attaches the result to ctx.referrer.
 *
 * This is intentionally non-blocking: if the API call fails, the error is
 * logged and the update continues without ctx.referrer being set.
 */
export function referrerSyncMiddleware(
  apiClient: ApiClient,
  logger: pino.Logger,
): MiddlewareFn<BotContext> {
  const log = logger.child({ context: 'ReferrerSync' });

  return async (ctx, next) => {
    const from = ctx.from;

    if (!from) {
      // Channel posts and other non-user updates — skip
      return next();
    }

    try {
      const referrer = await apiClient.syncReferrer({
        telegramId: String(from.id),
        telegramUsername: from.username,
        firstName: from.first_name,
        lastName: from.last_name,
      });

      ctx.referrer = {
        id: referrer.id,
        telegramId: referrer.telegramId,
        firstName: referrer.firstName,
        telegramUsername: referrer.telegramUsername,
      };

      // Store referrer ID in session for convenience
      if (ctx.session) {
        ctx.session.referrerId = referrer.id;
      }
    } catch (err) {
      // Non-blocking: log and continue
      log.error(
        { err, telegramId: String(from.id) },
        'Failed to sync referrer — continuing without ctx.referrer',
      );
    }

    return next();
  };
}
