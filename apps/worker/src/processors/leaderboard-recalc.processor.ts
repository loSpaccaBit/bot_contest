import type { Job } from 'bullmq';
import type Redis from 'ioredis';
import type { RecalcLeaderboardPayload, JobResult } from '@domusbet/shared-types';
import { fetchLeaderboard } from '../api/api.client';
import type { Logger } from 'pino';

const LEADERBOARD_CACHE_KEY = 'leaderboard:cache';
const LEADERBOARD_CACHE_TTL_SECONDS = 300; // 5 minutes

export async function processLeaderboardRecalc(
  job: Job<RecalcLeaderboardPayload>,
  redis: Redis,
  logger: Logger
): Promise<JobResult> {
  const { reason, triggeredByAdminId } = job.data;

  logger.info(
    { reason, triggeredByAdminId, jobId: job.id },
    'Starting leaderboard recalculation'
  );

  await job.updateProgress(10);

  const leaderboard = await fetchLeaderboard();

  await job.updateProgress(60);

  logger.info(
    { totalParticipants: leaderboard.totalParticipants },
    'Leaderboard data fetched'
  );

  const serialized = JSON.stringify({
    ...leaderboard,
    cachedAt: new Date().toISOString(),
  });

  await redis.set(LEADERBOARD_CACHE_KEY, serialized, 'EX', LEADERBOARD_CACHE_TTL_SECONDS);

  await job.updateProgress(90);

  logger.info(
    { key: LEADERBOARD_CACHE_KEY, ttl: LEADERBOARD_CACHE_TTL_SECONDS },
    'Leaderboard cached in Redis'
  );

  await job.updateProgress(100);

  return {
    success: true,
    message: `Leaderboard recalculated with ${leaderboard.totalParticipants} participants`,
    data: {
      totalParticipants: leaderboard.totalParticipants,
      generatedAt: leaderboard.generatedAt,
      cachedUntil: new Date(
        Date.now() + LEADERBOARD_CACHE_TTL_SECONDS * 1000
      ).toISOString(),
    },
  };
}
