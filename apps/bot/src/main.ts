import { createBot } from './bot';
import { validateBotEnv } from '@domusbet/config';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
});

async function main(): Promise<void> {
  const env = validateBotEnv();

  logger.info('Starting Domusbet Referral Bot...');

  const bot = await createBot(env, logger);

  // Graceful shutdown
  process.once('SIGINT', () => {
    logger.info('SIGINT received, stopping bot...');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    logger.info('SIGTERM received, stopping bot...');
    bot.stop('SIGTERM');
  });

  if (env.BOT_WEBHOOK_URL) {
    // Webhook mode — Telegram invia gli update via POST
    await bot.launch({
      webhook: {
        domain: env.BOT_WEBHOOK_URL,
        hookPath: '/bot-webhook',
        port: 3002,
      },
    });
    logger.info({ webhookUrl: `${env.BOT_WEBHOOK_URL}/bot-webhook` }, 'Bot in esecuzione in modalità webhook');
  } else {
    // Polling mode — solo per sviluppo locale
    await bot.launch();
    logger.info('Bot in esecuzione in modalità polling');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
