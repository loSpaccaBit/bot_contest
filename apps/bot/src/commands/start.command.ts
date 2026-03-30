import type { BotContext } from '../api/api.types';

/**
 * /start — Register and show the welcome message.
 *
 * The referrer is already synced by the referrerSyncMiddleware before this
 * command handler runs, so we just need to greet them.
 */
export async function handleStart(ctx: BotContext): Promise<void> {
  try {
    const firstName = ctx.from?.first_name ?? 'Amico';
    const message = await ctx.messageService.getWelcomeMessage({ firstName });
    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    ctx.logger.error({ err }, 'handleStart error');
    try {
      const errorMsg = await ctx.messageService.getGenericErrorMessage();
      await ctx.reply(errorMsg, { parse_mode: 'MarkdownV2' });
    } catch {
      await ctx.reply('❗ Si è verificato un errore. Riprova più tardi.').catch(() => {});
    }
  }
}
