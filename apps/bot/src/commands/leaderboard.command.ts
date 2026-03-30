import type { BotContext } from '../api/api.types';
import { SYSTEM_SETTING_KEYS } from '@domusbet/shared-types';
import { extractUserDisplayName } from '../utils/telegram.utils';

/**
 * /leaderboard — Show the top-10 leaderboard (if enabled) and the caller's own rank.
 */
export async function handleLeaderboard(ctx: BotContext): Promise<void> {
  try {
    // 1. Check whether the leaderboard is publicly visible
    let isPublic = false;
    try {
      const settings = await ctx.apiClient.getSettings([
        SYSTEM_SETTING_KEYS.LEADERBOARD_PUBLIC,
      ]);
      const raw = settings[SYSTEM_SETTING_KEYS.LEADERBOARD_PUBLIC];
      isPublic = raw === 'true' || raw === '1';
    } catch (err) {
      ctx.logger.warn({ err }, 'Failed to fetch leaderboard_public setting');
      // Default to not showing when setting is unavailable
    }

    if (!isPublic) {
      const msg = await ctx.messageService.getLeaderboardDisabledMessage();
      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
      return;
    }

    // 2. Fetch top-10 entries
    const leaderboard = await ctx.apiClient.getLeaderboard(1, 10);

    if (!leaderboard.entries.length) {
      const msg = await ctx.messageService.getLeaderboardEmptyMessage();
      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
      return;
    }

    // 3. Format entries for the template
    const entries = leaderboard.entries.map((e) => ({
      rank: e.rank,
      firstName: extractUserDisplayName({
        first_name: e.firstName ?? undefined,
        username: e.telegramUsername ?? undefined,
      }),
      points: e.totalPoints,
    }));

    const message = await ctx.messageService.getLeaderboardMessage(entries);

    // 4. Append caller's own rank if available
    const telegramId = ctx.from?.id;
    let positionNote = '';
    if (telegramId) {
      try {
        const position = await ctx.apiClient.getReferrerLeaderboardPosition(
          String(telegramId),
        );
        if (position) {
          const note = await ctx.messageService.getLeaderboardPositionMessage({
            rank: position.rank,
            totalPoints: position.totalPoints,
          });
          positionNote = `\n\n${note}`;
        }
      } catch {
        // Non-critical — skip silently
      }
    }

    await ctx.reply(message + positionNote, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    ctx.logger.error({ err }, 'handleLeaderboard error');
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
