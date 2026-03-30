/**
 * Shared Telegram utility helpers.
 */

interface TelegramUser {
  first_name?: string;
  last_name?: string;
  username?: string;
}

/**
 * Returns the best available display name for a Telegram user.
 * Priority: first_name > @username > "Utente sconosciuto"
 */
export function extractUserDisplayName(from: TelegramUser): string {
  if (from.first_name) {
    return from.last_name
      ? `${from.first_name} ${from.last_name}`
      : from.first_name;
  }
  if (from.username) {
    return `@${from.username}`;
  }
  return 'Utente sconosciuto';
}

/**
 * Formats a point value with thousands separators.
 * e.g. 1500 → "1.500"
 */
export function formatPoints(points: number): string {
  return new Intl.NumberFormat('it-IT').format(points);
}

/**
 * Escapes special characters for Telegram MarkdownV2.
 */
export function escapeMdV2(text: string): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

/**
 * Validates whether a string looks like a plausible Domusbet username.
 *
 * Rules:
 * - 3–32 characters
 * - Only alphanumeric characters, underscores, and hyphens
 * - Must start with a letter or digit
 */
export function isValidDomusbetUsername(username: string): boolean {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 32) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/.test(trimmed);
}

/**
 * Normalizes a Domusbet username: trim whitespace and convert to lowercase.
 */
export function normalizeDomusbetUsername(username: string): string {
  return username.trim().toLowerCase();
}
