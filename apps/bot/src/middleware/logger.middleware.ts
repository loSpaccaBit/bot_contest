import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from '../api/api.types';
import type pino from 'pino';

/**
 * Logs every incoming Telegram update with basic metadata.
 */
export function loggerMiddleware(logger: pino.Logger): MiddlewareFn<BotContext> {
  const log = logger.child({ context: 'TelegramUpdate' });

  return async (ctx, next) => {
    const start = Date.now();

    const userId = ctx.from?.id;
    const username = ctx.from?.username;
    const chatId = ctx.chat?.id;
    const updateType = ctx.updateType;

    // Determine a human-friendly sub-type (e.g. "text", "sticker", "callback_query")
    let messageType: string | undefined;
    if (ctx.message) {
      const msg = ctx.message as Record<string, unknown>;
      if ('text' in msg) messageType = 'text';
      else if ('photo' in msg) messageType = 'photo';
      else if ('sticker' in msg) messageType = 'sticker';
      else if ('voice' in msg) messageType = 'voice';
      else if ('document' in msg) messageType = 'document';
      else messageType = 'other';
    }

    log.debug(
      { updateType, messageType, userId, username, chatId },
      'Incoming update',
    );

    await next();

    log.debug(
      { updateType, userId, durationMs: Date.now() - start },
      'Update processed',
    );
  };
}
