/**
 * Simple, safe template parser for bot messages.
 * Replaces {variableName} placeholders with provided values.
 *
 * Example:
 *   parseTemplate("Hello {firstName}!", { firstName: "Mario" })
 *   // => "Hello Mario!"
 */
export function parseTemplate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Extract all placeholder keys from a template string.
 */
export function extractTemplatePlaceholders(template: string): string[] {
  const matches = template.matchAll(/\{(\w+)\}/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

/**
 * Validate that a template only uses allowed placeholder keys.
 */
export function validateTemplatePlaceholders(
  template: string,
  allowedKeys: string[],
): { valid: boolean; unknownKeys: string[] } {
  const found = extractTemplatePlaceholders(template);
  const unknownKeys = found.filter((k) => !allowedKeys.includes(k));
  return { valid: unknownKeys.length === 0, unknownKeys };
}

/**
 * Escapes Telegram MarkdownV2 special characters in a plain string.
 * Use before inserting dynamic values into MarkdownV2 templates.
 */
export function escapeTelegramMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

/**
 * Parses a template and escapes all interpolated variable values for
 * safe use in Telegram MarkdownV2 messages.
 */
export function parseTemplateMarkdownV2(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) return match;
    return escapeTelegramMarkdownV2(String(value));
  });
}
