import type { BotContext } from '../api/api.types';

/**
 * /help — Show available commands and usage instructions.
 */
export async function handleHelp(ctx: BotContext): Promise<void> {
  try {
    const text = await ctx.messageService.getHelpMessage();
    await ctx.reply(text, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    ctx.logger.error({ err }, 'handleHelp error');
    await ctx.reply('❗ Si è verificato un errore\\. Riprova più tardi\\.', { parse_mode: 'MarkdownV2' }).catch(() => {});
  }
}
