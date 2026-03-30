import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from '../api/api.types';
import type { Redis } from 'ioredis';
import type pino from 'pino';

// Configuration
const WINDOW_SECONDS = 3600; // 1 hour sliding window
const MAX_REQUESTS_PER_WINDOW = 10; // max submissions per hour per user

/**
 * Sliding-window rate limiter backed by Redis.
 *
 * Uses a sorted set per user where each member is a unique request timestamp.
 * Members outside the current window are pruned on every check.
 *
 * Key format: `rl:bot:{userId}`
 */
export function rateLimitMiddleware(
  redis: Redis,
  logger: pino.Logger,
): MiddlewareFn<BotContext> {
  const log = logger.child({ context: 'RateLimit' });

  return async (ctx, next) => {
    const userId = ctx.from?.id;

    // No user ID (e.g. channel posts) — skip rate limiting
    if (!userId) {
      return next();
    }

    // Only rate-limit text messages that look like username submissions
    // (commands bypass rate limiting; they are handled by their own handlers)
    const isTextMessage =
      ctx.updateType === 'message' &&
      'text' in (ctx.message ?? {});

    if (!isTextMessage) {
      return next();
    }

    const text = (ctx.message as { text?: string } | undefined)?.text ?? '';
    if (text.startsWith('/')) {
      // Commands are never rate-limited
      return next();
    }

    const key = `rl:bot:${userId}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SECONDS * 1000;

    try {
      const pipe = redis.pipeline();

      // Remove entries outside the current window
      pipe.zremrangebyscore(key, '-inf', windowStart);

      // Count remaining entries in window
      pipe.zcard(key);

      // Add current request
      pipe.zadd(key, now, `${now}-${Math.random()}`);

      // Ensure the key expires after the window
      pipe.expire(key, WINDOW_SECONDS);

      const results = await pipe.exec();

      // zcard result is at index 1
      const countResult = results?.[1];
      const currentCount =
        countResult && !countResult[0] ? (countResult[1] as number) : 0;

      if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
        log.warn(
          { userId, currentCount },
          'Rate limit exceeded for user',
        );

        // ctx.messageService is available because the service injection middleware
        // runs before this one.
        let rateLimitMsg: string;
        try {
          rateLimitMsg = await ctx.messageService.getRateLimitMessage({
            maxRequests: MAX_REQUESTS_PER_WINDOW,
          });
        } catch {
          rateLimitMsg =
            `⏳ Hai superato il limite di *${MAX_REQUESTS_PER_WINDOW} invii* per ora\\.\n` +
            'Riprova tra qualche minuto\\.';
        }

        await ctx.reply(rateLimitMsg, { parse_mode: 'MarkdownV2' });
        return; // do NOT call next()
      }
    } catch (err) {
      // Redis failure must never block the bot
      log.error({ err, userId }, 'Redis rate-limit check failed, allowing request');
    }

    return next();
  };
}
