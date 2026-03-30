/**
 * Re-exports bot configuration from the shared @domusbet/config package.
 *
 * All validation and the BotEnv type live in packages/config/src/bot.config.ts.
 * Import from there (or from '@domusbet/config') throughout the application.
 */
export { validateBotEnv, type BotEnv } from '@domusbet/config';
