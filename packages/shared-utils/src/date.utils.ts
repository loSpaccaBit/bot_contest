/**
 * Returns the start of a given day (00:00:00.000 UTC).
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the end of a given day (23:59:59.999 UTC).
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Returns the start of the current week (Monday 00:00:00.000 UTC).
 */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  // Monday = 1, so offset = (day + 6) % 7
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the start of the current month (1st day 00:00:00.000 UTC).
 */
export function startOfMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats a date as an ISO 8601 date string (YYYY-MM-DD).
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parses a date value that could be a Date object or ISO string.
 */
export function parseDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Returns true if two dates represent the same calendar day (UTC).
 */
export function isSameDay(a: Date, b: Date): boolean {
  return toISODateString(a) === toISODateString(b);
}
