import type { Job } from 'bullmq';
import type { JobPayload, JobResult } from '@domusbet/shared-types';
import { JobName } from '@domusbet/shared-types';
import { fetchLeaderboard } from '../api/api.client';
import type { Logger } from 'pino';

async function processExportLeaderboard(
  job: Job<JobPayload>,
  logger: Logger
): Promise<JobResult> {
  const payload = job.data as Extract<JobPayload, { job: JobName.EXPORT_LEADERBOARD }>;

  logger.info(
    { format: payload.format, topN: payload.topN },
    'Processing leaderboard export'
  );

  await job.updateProgress(20);

  const leaderboard = await fetchLeaderboard();

  await job.updateProgress(60);

  let entries = leaderboard.entries;
  if (payload.topN) {
    entries = entries.slice(0, payload.topN);
  }

  if (!payload.includeAllReferrers) {
    entries = entries.filter((e) => e.totalPoints > 0);
  }

  await job.updateProgress(80);

  const exportData = {
    generatedAt: new Date().toISOString(),
    format: payload.format,
    totalEntries: entries.length,
    entries,
  };

  // If a Telegram delivery target is set, the actual file generation + delivery
  // would happen here (via Telegram Bot API sendDocument). Stubbed for now.
  if (payload.deliverToTelegramId) {
    logger.info(
      { deliverToTelegramId: payload.deliverToTelegramId },
      'Leaderboard export delivery via Telegram is stubbed'
    );
  }

  await job.updateProgress(100);

  logger.info({ totalEntries: entries.length }, 'Leaderboard export complete');

  return {
    success: true,
    message: `Leaderboard exported with ${entries.length} entries in ${payload.format} format`,
    data: {
      totalEntries: entries.length,
      format: payload.format,
      exportData,
    },
  };
}

export async function processAdminTask(
  job: Job<JobPayload>,
  logger: Logger
): Promise<JobResult> {
  const { data } = job;

  switch (data.job) {
    case JobName.EXPORT_LEADERBOARD:
      return processExportLeaderboard(job, logger);

    default:
      logger.warn({ jobName: (data as { job: string }).job }, 'Unknown admin task job type');
      return {
        success: false,
        message: `Unknown admin task: ${(data as { job: string }).job}`,
      };
  }
}
