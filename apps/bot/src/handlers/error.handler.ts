import type { BotContext } from '../api/api.types';
import type pino from 'pino';

/**
 * Global error handler for the Telegraf bot.
 *
 * This is passed to `bot.catch()` and ensures the bot never crashes on
 * unhandled errors — it logs the error and attempts to inform the user.
 */
export function handleBotError(
  logger: pino.Logger,
): (err: unknown, ctx: BotContext) => void {
  const log = logger.child({ context: 'BotError' });

  return (err: unknown, ctx: BotContext) => {
    log.error(
      {
        err,
        updateType: ctx.updateType,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id,
      },
      'Unhandled bot error',
    );

    // Attempt to notify the user; swallow any secondary errors silently
    ctx
      .reply('❗ Si è verificato un errore imprevisto. Riprova più tardi.')
      .catch((replyErr: unknown) => {
        log.warn({ replyErr }, 'Failed to send error reply to user');
      });
  };
}
