/**
 * Normalizes a Domusbet username for consistent storage and comparison.
 * Rules:
 * - Trim whitespace
 * - Remove leading '@'
 * - Lowercase
 * - Remove internal whitespace
 */
export function normalizeDomusbetUsername(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Username must be a non-empty string');
  }
  return raw.trim().replace(/^@/, '').replace(/\s+/g, '').toLowerCase();
}

export function isValidDomusbetUsername(raw: string): boolean {
  try {
    const normalized = normalizeDomusbetUsername(raw);
    // Must be 3-32 chars, alphanumeric + underscore + dot
    return /^[a-z0-9_.]{3,32}$/.test(normalized);
  } catch {
    return false;
  }
}

/**
 * Formats a display name from first and last name parts.
 * Falls back to a default if both are absent.
 */
export function formatDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  fallback = 'Utente',
): string {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : fallback;
}

/**
 * Formats a Telegram username for display (adds @ prefix).
 */
export function formatTelegramUsername(username?: string | null): string | null {
  if (!username) return null;
  return username.startsWith('@') ? username : `@${username}`;
}
