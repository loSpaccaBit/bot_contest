export interface BotMessageTemplateDto {
  id: string;
  key: string;
  name: string;
  content: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBotMessageTemplateDto {
  key: string;
  name: string;
  content: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateBotMessageTemplateDto {
  name?: string;
  content?: string;
  description?: string;
  isActive?: boolean;
}

/**
 * Known bot message template keys used throughout the application.
 * These keys must exist in the database for the bot to function.
 */
export const BOT_MESSAGE_KEYS = {
  WELCOME_MESSAGE: 'welcome_message',
  SUBMISSION_RECEIVED: 'submission_received',
  DUPLICATE_SUBMISSION: 'duplicate_submission',
  SUBMISSION_APPROVED: 'submission_approved',
  SUBMISSION_REJECTED: 'submission_rejected',
  LEADERBOARD_MESSAGE: 'leaderboard_message',
  LEADERBOARD_POSITION: 'leaderboard_position',
  LEADERBOARD_DISABLED: 'leaderboard_disabled',
  LEADERBOARD_EMPTY: 'leaderboard_empty',
  MY_STATS: 'my_stats',
  GENERIC_ERROR: 'generic_error',
  INVALID_USERNAME: 'invalid_username',
  RATE_LIMIT: 'rate_limit',
  HELP_MESSAGE: 'help_message',
} as const;

export type BotMessageKey = (typeof BOT_MESSAGE_KEYS)[keyof typeof BOT_MESSAGE_KEYS];

/**
 * Maps each bot message key to its available template variables.
 */
export const BOT_MESSAGE_PLACEHOLDERS: Record<BotMessageKey, string[]> = {
  [BOT_MESSAGE_KEYS.WELCOME_MESSAGE]: ['firstName', 'lastName', 'appName'],
  [BOT_MESSAGE_KEYS.SUBMISSION_RECEIVED]: ['domusbetUsername', 'firstName'],
  [BOT_MESSAGE_KEYS.DUPLICATE_SUBMISSION]: ['domusbetUsername', 'firstName'],
  [BOT_MESSAGE_KEYS.SUBMISSION_APPROVED]: [
    'domusbetUsername',
    'points',
    'firstName',
    'totalPoints',
    'linkBot',
    'linkCanale',
  ],
  [BOT_MESSAGE_KEYS.SUBMISSION_REJECTED]: ['domusbetUsername', 'rejectionReason', 'firstName'],
  [BOT_MESSAGE_KEYS.LEADERBOARD_MESSAGE]: ['entries'],
  [BOT_MESSAGE_KEYS.LEADERBOARD_POSITION]: ['rank', 'totalPoints'],
  [BOT_MESSAGE_KEYS.LEADERBOARD_DISABLED]: [],
  [BOT_MESSAGE_KEYS.LEADERBOARD_EMPTY]: [],
  [BOT_MESSAGE_KEYS.MY_STATS]: [
    'firstName',
    'totalPoints',
    'totalSubmissions',
    'approvedSubmissions',
    'pendingSubmissions',
    'rank',
  ],
  [BOT_MESSAGE_KEYS.GENERIC_ERROR]: ['errorCode'],
  [BOT_MESSAGE_KEYS.INVALID_USERNAME]: ['username'],
  [BOT_MESSAGE_KEYS.RATE_LIMIT]: ['maxRequests'],
  [BOT_MESSAGE_KEYS.HELP_MESSAGE]: [],
};
