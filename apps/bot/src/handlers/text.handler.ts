import type { BotContext } from '../api/api.types';
import { normalizeDomusbetUsername, isValidDomusbetUsername } from '@domusbet/shared-utils';

/**
 * Handles free-text messages.
 *
 * Any non-command text is treated as a Domusbet username submission attempt.
 */
export async function handleTextMessage(ctx: BotContext): Promise<void> {
  try {
    // 1. Extract text (type guard: telegraf only routes 'text' updates here)
    const text = (ctx.message as { text?: string } | undefined)?.text;
    if (!text) return;

    // 2. Ignore commands — they are handled by dedicated command handlers
    if (text.startsWith('/')) return;

    // 3. Validate username format
    if (!isValidDomusbetUsername(text)) {
      const errMsg = await ctx.messageService.getInvalidUsernameMessage({
        username: text.slice(0, 40),
      });
      await ctx.reply(errMsg, { parse_mode: 'MarkdownV2' });
      return;
    }

    // 4. Normalise
    const normalized = normalizeDomusbetUsername(text);

    // 5. Attempt to create the submission
    const result = await ctx.submissionService.createSubmission(
      String(ctx.from!.id),
      text,
      {
        telegramUsername: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
      },
    );

    // 6. Reply based on result
    const firstName = ctx.from?.first_name ?? '';

    if (result.isDuplicate) {
      const msg = await ctx.messageService.getDuplicateSubmissionMessage({
        domusbetUsername: normalized,
        firstName,
      });
      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
    } else if (result.success) {
      const msg = await ctx.messageService.getSubmissionReceivedMessage({
        domusbetUsername: normalized,
        firstName,
      });
      await ctx.reply(msg, { parse_mode: 'MarkdownV2' });
    } else {
      const errMsg = await ctx.messageService.getGenericErrorMessage();
      await ctx.reply(errMsg, { parse_mode: 'MarkdownV2' });
    }
  } catch (err) {
    ctx.logger.error({ err }, 'handleTextMessage error');
    try {
      const errMsg = await ctx.messageService.getGenericErrorMessage();
      await ctx.reply(errMsg, { parse_mode: 'MarkdownV2' });
    } catch {
      await ctx
        .reply('❗ Si è verificato un errore. Riprova più tardi.')
        .catch(() => {});
    }
  }
}
