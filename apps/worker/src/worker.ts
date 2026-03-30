import { Worker, type WorkerOptions } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { QueueName } from '@domusbet/shared-types';
import { getWorkerConfig } from './config/worker.config';
import { processTelegramNotification } from './processors/telegram-notification.processor';
import { processLeaderboardRecalc } from './processors/leaderboard-recalc.processor';
import { processAdminTask } from './processors/admin-tasks.processor';

export function createWorkers(redis: Redis, logger: Logger): Worker[] {
  const config = getWorkerConfig();

  const baseOptions: WorkerOptions = {
    connection: redis,
    concurrency: config.WORKER_CONCURRENCY,
    maxStalledCount: config.WORKER_MAX_STALLED_COUNT,
    stalledInterval: 30_000,
  };

  // ─── Telegram Notifications Worker ───────────────────────────────────────
  const telegramWorker = new Worker(
    QueueName.TELEGRAM_NOTIFICATIONS,
    async (job) => {
      const jobLogger = logger.child({
        queue: QueueName.TELEGRAM_NOTIFICATIONS,
        jobId: job.id,
        jobName: job.name,
      });

      try {
        return await processTelegramNotification(job as Parameters<typeof processTelegramNotification>[0], jobLogger, redis);
      } catch (error) {
        jobLogger.error({ error }, 'Telegram notification job failed');
        throw error;
      }
    },
    { ...baseOptions, concurrency: 3 }
  );

  telegramWorker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Telegram notification completed');
  });

  telegramWorker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      'Telegram notification failed'
    );
  });

  telegramWorker.on('error', (error) => {
    logger.error({ error: error.message }, 'Telegram worker error');
  });

  // ─── Leaderboard Recalc Worker ────────────────────────────────────────────
  const leaderboardWorker = new Worker(
    QueueName.LEADERBOARD_RECALC,
    async (job) => {
      const jobLogger = logger.child({
        queue: QueueName.LEADERBOARD_RECALC,
        jobId: job.id,
        jobName: job.name,
      });

      try {
        return await processLeaderboardRecalc(
          job as Parameters<typeof processLeaderboardRecalc>[0],
          redis,
          jobLogger
        );
      } catch (error) {
        jobLogger.error({ error }, 'Leaderboard recalc job failed');
        throw error;
      }
    },
    { ...baseOptions, concurrency: 1 } // Serialize leaderboard recalcs
  );

  leaderboardWorker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Leaderboard recalc completed');
  });

  leaderboardWorker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      'Leaderboard recalc failed'
    );
  });

  leaderboardWorker.on('error', (error) => {
    logger.error({ error: error.message }, 'Leaderboard worker error');
  });

  // ─── Admin Tasks Worker ───────────────────────────────────────────────────
  const adminTasksWorker = new Worker(
    QueueName.ADMIN_TASKS,
    async (job) => {
      const jobLogger = logger.child({
        queue: QueueName.ADMIN_TASKS,
        jobId: job.id,
        jobName: job.name,
      });

      try {
        return await processAdminTask(
          job as Parameters<typeof processAdminTask>[0],
          jobLogger
        );
      } catch (error) {
        jobLogger.error({ error }, 'Admin task job failed');
        throw error;
      }
    },
    { ...baseOptions, concurrency: 2 }
  );

  adminTasksWorker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, 'Admin task completed');
  });

  adminTasksWorker.on('failed', (job, error) => {
    logger.error(
      { jobId: job?.id, error: error.message },
      'Admin task failed'
    );
  });

  adminTasksWorker.on('error', (error) => {
    logger.error({ error: error.message }, 'Admin tasks worker error');
  });

  return [telegramWorker, leaderboardWorker, adminTasksWorker];
}
