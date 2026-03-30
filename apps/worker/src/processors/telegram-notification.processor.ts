import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import axios from 'axios';
import type {
  SendApprovalNotificationPayload,
  SendRejectionNotificationPayload,
  NotificationJobResult,
  JobPayload,
} from '@domusbet/shared-types';
import { JobName } from '@domusbet/shared-types';
import type { Logger } from 'pino';

// ─── Config ──────────────────────────────────────────────────────────────────

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID ?? '';
const BOT_USERNAME = process.env.BOT_USERNAME ?? '';
const WORKER_API_URL = process.env.WORKER_API_URL ?? 'http://localhost:3001';
const WORKER_API_INTERNAL_SECRET = process.env.WORKER_API_INTERNAL_SECRET ?? '';
const REDIS_TEMPLATE_KEY_PREFIX = 'bot:msg:';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TelegramSendMessageResponse {
  ok: boolean;
  result?: { message_id: number };
  description?: string;
}

interface TelegramInviteLinkResponse {
  ok: boolean;
  result?: { invite_link: string };
  description?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeMdV2(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Renders an approval notification template.
 * Text variables (firstName, domusbetUsername, points, totalPoints) are escaped for MarkdownV2.
 * URL variables (linkBot, linkCanale) are injected raw — they must be used in [text](url) syntax.
 */
export function renderApprovalTemplate(
  template: string,
  vars: {
    firstName: string;
    domusbetUsername: string;
    points: number;
    totalPoints: number;
    linkBot?: string;
    linkCanale?: string;
  },
): string {
  const escaped: Record<string, string> = {
    firstName: escapeMdV2(vars.firstName),
    domusbetUsername: escapeMdV2(vars.domusbetUsername),
    points: escapeMdV2(String(vars.points)),
    totalPoints: escapeMdV2(String(vars.totalPoints)),
  };

  // Step 1: replace escaped text variables
  let result = template.replace(/\{(\w+)\}/g, (match, key: string) =>
    escaped[key] !== undefined ? escaped[key] : match,
  );

  // Step 2: inject URL variables raw (no escaping — used inside MarkdownV2 link parens)
  if (vars.linkBot) result = result.replace(/\{linkBot\}/g, vars.linkBot);
  if (vars.linkCanale) result = result.replace(/\{linkCanale\}/g, vars.linkCanale);

  return result;
}

// ─── Template fetching ───────────────────────────────────────────────────────

async function fetchTemplate(key: string, redis: Redis): Promise<string | null> {
  try {
    const cached = await redis.get(`${REDIS_TEMPLATE_KEY_PREFIX}${key}`);
    if (cached) return cached;
  } catch {
    // Redis unavailable — fall through to API
  }

  try {
    const res = await axios.get<{ content: string; isActive: boolean }>(
      `${WORKER_API_URL}/api/internal/bot-messages/${key}`,
      { headers: { 'x-internal-secret': WORKER_API_INTERNAL_SECRET } },
    );
    if (res.data?.isActive) return res.data.content;
  } catch {
    // API also unavailable
  }

  return null;
}

// ─── Telegram API helpers ─────────────────────────────────────────────────────

async function sendTelegramMessage(chatId: string, text: string): Promise<number> {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const res = await axios.post<TelegramSendMessageResponse>(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    { chat_id: chatId, text, parse_mode: 'MarkdownV2' },
  );

  if (!res.data.ok) {
    throw new Error(`Telegram sendMessage failed: ${res.data.description ?? 'unknown'}`);
  }
  return res.data.result?.message_id ?? 0;
}

async function createChannelInviteLink(): Promise<{ link: string; linkId: string }> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not configured');
  }

  const res = await axios.post<TelegramInviteLinkResponse>(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
    { chat_id: TELEGRAM_CHANNEL_ID, creates_join_request: false },
  );

  if (!res.data.ok || !res.data.result?.invite_link) {
    throw new Error(`createChatInviteLink failed: ${res.data.description ?? 'unknown'}`);
  }

  return { link: res.data.result.invite_link, linkId: res.data.result.invite_link };
}

// ─── Channel link: get or create via internal API ────────────────────────────

async function getOrCreateChannelLink(telegramId: string, logger: Logger): Promise<string | null> {
  if (!TELEGRAM_CHANNEL_ID) return null;

  const internalHeaders = { 'x-internal-secret': WORKER_API_INTERNAL_SECRET };

  // 1. Check if referrer already has a link stored
  try {
    const res = await axios.get<{ channelInviteLink: string | null }>(
      `${WORKER_API_URL}/api/internal/referrers/${telegramId}/channel-link`,
      { headers: internalHeaders },
    );
    if (res.data.channelInviteLink) return res.data.channelInviteLink;
  } catch (err) {
    logger.warn({ err, telegramId }, 'Failed to fetch channel link from API');
    return null;
  }

  // 2. Generate new invite link via Telegram API
  let link: string;
  let linkId: string;
  try {
    ({ link, linkId } = await createChannelInviteLink());
  } catch (err) {
    logger.error({ err }, 'Failed to create Telegram channel invite link');
    return null;
  }

  // 3. Save to referrer record
  try {
    await axios.patch(
      `${WORKER_API_URL}/api/internal/referrers/${telegramId}/channel-link`,
      { channelInviteLink: link, channelInviteLinkId: linkId },
      { headers: internalHeaders },
    );
  } catch (err) {
    logger.warn({ err, telegramId }, 'Failed to save channel link to API — link was generated but not persisted');
  }

  return link;
}

// ─── Job processors ──────────────────────────────────────────────────────────

async function processApprovalNotification(
  payload: SendApprovalNotificationPayload,
  redis: Redis,
  logger: Logger,
): Promise<NotificationJobResult> {
  const { telegramId, referrerId, firstName, domusbetUsername, points, totalPoints, submissionId } = payload;

  const template = await fetchTemplate('submission_approved', redis);

  // Fallback to hardcoded message if template is not configured
  if (!template) {
    logger.warn({ submissionId }, 'submission_approved template not found, using fallback');
    const fallback = [
      `✅ La tua segnalazione è stata *approvata*\\!`,
      '',
      `👤 Account: \`${escapeMdV2(domusbetUsername)}\``,
      `🏆 Punti: *\\+${points}*`,
      `📊 Totale: *${totalPoints}*`,
    ].join('\n');
    const msgId = await sendTelegramMessage(telegramId, fallback);
    return { success: true, sent: true, telegramMessageId: msgId, message: 'Approval sent (fallback)' };
  }

  // Resolve URL variables only if template uses them
  const needsLinkBot = template.includes('{linkBot}');
  const needsLinkCanale = template.includes('{linkCanale}');

  const linkBot = needsLinkBot && BOT_USERNAME && referrerId
    ? `https://t.me/${BOT_USERNAME}?start=ref_${referrerId}`
    : undefined;

  const linkCanale = needsLinkCanale
    ? (await getOrCreateChannelLink(telegramId, logger)) ?? undefined
    : undefined;

  const text = renderApprovalTemplate(template, {
    firstName: firstName ?? '',
    domusbetUsername,
    points,
    totalPoints,
    linkBot,
    linkCanale,
  });

  logger.info({ telegramId, submissionId }, 'Sending approval notification');
  const messageId = await sendTelegramMessage(telegramId, text);
  logger.info({ telegramId, messageId }, 'Approval notification sent');

  return {
    success: true,
    sent: true,
    telegramMessageId: messageId,
    message: `Approval notification sent to ${telegramId}`,
  };
}

async function processRejectionNotification(
  payload: SendRejectionNotificationPayload,
  redis: Redis,
  logger: Logger,
): Promise<NotificationJobResult> {
  const { telegramId, firstName, domusbetUsername, rejectionReason, submissionId } = payload;

  const template = await fetchTemplate('submission_rejected', redis);

  let text: string;
  if (template) {
    const escaped: Record<string, string> = {
      firstName: escapeMdV2(firstName ?? ''),
      domusbetUsername: escapeMdV2(domusbetUsername),
      rejectionReason: escapeMdV2(rejectionReason),
    };
    text = template.replace(/\{(\w+)\}/g, (match, key: string) =>
      escaped[key] !== undefined ? escaped[key] : match,
    );
  } else {
    logger.warn({ submissionId }, 'submission_rejected template not found, using fallback');
    text = [
      `❌ La tua segnalazione è stata *rifiutata*\\.`,
      '',
      `👤 Account: \`${escapeMdV2(domusbetUsername)}\``,
      `📝 Motivo: _${escapeMdV2(rejectionReason)}_`,
    ].join('\n');
  }

  logger.info({ telegramId, submissionId }, 'Sending rejection notification');
  const messageId = await sendTelegramMessage(telegramId, text);
  logger.info({ telegramId, messageId }, 'Rejection notification sent');

  return {
    success: true,
    sent: true,
    telegramMessageId: messageId,
    message: `Rejection notification sent to ${telegramId}`,
  };
}

export async function processTelegramNotification(
  job: Job<JobPayload>,
  logger: Logger,
  redis: Redis,
): Promise<NotificationJobResult> {
  const { data } = job;

  if (data.job === JobName.SEND_APPROVAL_NOTIFICATION) {
    return processApprovalNotification(data as SendApprovalNotificationPayload, redis, logger);
  }

  if (data.job === JobName.SEND_REJECTION_NOTIFICATION) {
    return processRejectionNotification(data as SendRejectionNotificationPayload, redis, logger);
  }

  logger.warn({ jobName: (data as { job: string }).job }, 'Unknown notification job type');
  return {
    success: false,
    sent: false,
    message: `Unknown notification job: ${(data as { job: string }).job}`,
  };
}
