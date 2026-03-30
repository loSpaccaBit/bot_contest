import { Telegraf, session } from 'telegraf';
import type { BotContext } from './api/api.types';
import type { BotEnv } from '@domusbet/config';
import { ApiClient } from './api/api.client';
import { MessageService } from './services/message.service';
import { SubmissionService } from './services/submission.service';
import { loggerMiddleware } from './middleware/logger.middleware';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { referrerSyncMiddleware } from './middleware/referrer-sync.middleware';
import { handleStart } from './commands/start.command';
import { handleMyStats } from './commands/mystats.command';
import { handleLeaderboard } from './commands/leaderboard.command';
import { handleHelp } from './commands/help.command';
import { handleTextMessage } from './handlers/text.handler';
import { handleBotError } from './handlers/error.handler';
import Redis from 'ioredis';
import type pino from 'pino';

export async function createBot(
  env: BotEnv,
  logger: pino.Logger,
): Promise<Telegraf<BotContext>> {
  // ─── Infrastructure ──────────────────────────────────────────────────────────
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
  });

  redis.on('error', (err) => {
    logger.warn({ err }, 'Redis connection error');
  });

  await redis.connect().catch((err) => {
    logger.warn({ err }, 'Redis initial connect failed — rate limiting may be degraded');
  });

  // ─── Services ─────────────────────────────────────────────────────────────────
  const apiClient = new ApiClient(
    env.BOT_API_URL,
    env.BOT_API_INTERNAL_SECRET,
    logger,
  );
  const messageService = new MessageService(apiClient, redis, logger);
  const submissionService = new SubmissionService(apiClient, logger);

  // Pre-load all bot message templates into Redis
  await apiClient.warmBotMessageCache().catch((err) => {
    logger.warn({ err }, 'Bot message Redis warm-up failed — messages will be fetched on demand');
  });

  // ─── Bot ──────────────────────────────────────────────────────────────────────
  const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // Session (in-memory by default; swap for Redis-backed session in production)
  bot.use(session());

  // Inject services into context early so every downstream middleware can use them
  bot.use((ctx, next) => {
    ctx.apiClient = apiClient;
    ctx.messageService = messageService;
    ctx.submissionService = submissionService;
    ctx.logger = logger;
    return next();
  });

  // Logging
  bot.use(loggerMiddleware(logger));

  // Rate limiting (uses ctx.messageService for error replies — must run after injection)
  bot.use(rateLimitMiddleware(redis, logger));

  // Referrer sync — must run before any command handler so ctx.referrer is set
  bot.use(referrerSyncMiddleware(apiClient, logger));

  // ─── Commands ─────────────────────────────────────────────────────────────────
  bot.command('start', handleStart);
  bot.command(['statistiche', 'mystats'], handleMyStats);
  bot.command(['classifica', 'leaderboard'], handleLeaderboard);
  bot.command(['aiuto', 'help'], handleHelp);

  // Register command list so Telegram shows the menu in Italian
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Avvia il bot e registrati' },
    { command: 'statistiche', description: 'Visualizza le tue statistiche' },
    { command: 'classifica', description: 'Visualizza la classifica' },
    { command: 'aiuto', description: 'Mostra i comandi disponibili' },
  ]);

  // Show the commands list when the user taps the menu button (bottom-left)
  await bot.telegram.setChatMenuButton({ menuButton: { type: 'commands' } });

  // ─── Text handler (username submission) ───────────────────────────────────────
  bot.on('text', handleTextMessage);

  // ─── Global error handler ─────────────────────────────────────────────────────
  bot.catch(handleBotError(logger));

  return bot;
}
