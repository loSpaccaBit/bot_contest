import pino from 'pino';
import IORedis from 'ioredis';
import { getWorkerConfig } from './config/worker.config';
import { createWorkers } from './worker';

const config = getWorkerConfig();

const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

async function main(): Promise<void> {
  logger.info('Starting domusbet-referral workers...');

  const redis = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('error', (err) => logger.error({ err: err.message }, 'Redis error'));
  redis.on('close', () => logger.warn('Redis connection closed'));

  await redis.connect();

  const workers = createWorkers(redis, logger);

  logger.info(
    { workerCount: workers.length },
    'All workers started successfully'
  );

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'Received shutdown signal, closing workers...');

    const closePromises = workers.map((worker) =>
      worker.close().catch((err: unknown) => {
        logger.error(
          { error: err instanceof Error ? err.message : String(err) },
          'Error closing worker'
        );
      })
    );

    await Promise.allSettled(closePromises);

    await redis.quit();

    logger.info('All workers shut down gracefully');
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
    void shutdown('unhandledRejection');
  });
}

main().catch((error: unknown) => {
  console.error('Fatal startup error:', error);
  process.exit(1);
});
