import type { BotContext } from '../api/api.types';

/**
 * /mystats — Display the referrer's current stats.
 */
export async function handleMyStats(ctx: BotContext): Promise<void> {
  try {
    const telegramId = ctx.from?.id;

    if (!telegramId) {
      await ctx.reply('❗ Impossibile identificare il tuo account. Riprova.');
      return;
    }

    const stats = await ctx.apiClient.getReferrerStats(String(telegramId));
    const firstName =
      ctx.from?.first_name ?? ctx.referrer?.firstName ?? 'Amico';

    const message = await ctx.messageService.getMyStatsMessage({
      firstName,
      totalPoints: stats.totalPoints,
      approvedSubmissions: stats.approvedSubmissions,
      pendingSubmissions: stats.pendingSubmissions,
      totalSubmissions: stats.totalSubmissions,
      rank: stats.rank,
    });

    await ctx.reply(message, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    ctx.logger.error({ err }, 'handleMyStats error');
    try {
      const errorMsg = await ctx.messageService.getGenericErrorMessage();
      await ctx.reply(errorMsg, { parse_mode: 'MarkdownV2' });
    } catch {
      await ctx
        .reply('❗ Si è verificato un errore. Riprova più tardi.')
        .catch(() => {});
    }
  }
}
