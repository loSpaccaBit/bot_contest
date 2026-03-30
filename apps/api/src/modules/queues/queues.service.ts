import { Injectable, Logger, Inject } from '@nestjs/common';
import { Queue, type Job } from 'bullmq';
import { JobName } from '@domusbet/shared-types';
import type {
  SendApprovalNotificationPayload,
  SendRejectionNotificationPayload,
} from '@domusbet/shared-types';
import {
  TELEGRAM_QUEUE_TOKEN,
  LEADERBOARD_QUEUE_TOKEN,
  ADMIN_TASKS_QUEUE_TOKEN,
} from './queues.constants';

export interface ApprovalNotificationInput {
  telegramId: string;
  referrerId: string;
  submissionId: string;
  domusbetUsername: string;
  points: number;
  totalPoints: number;
  firstName?: string | null;
}

export interface RejectionNotificationInput {
  telegramId: string;
  submissionId: string;
  domusbetUsername: string;
  rejectionReason: string;
  firstName?: string | null;
}

@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);

  constructor(
    @Inject(TELEGRAM_QUEUE_TOKEN)
    private readonly telegramQueue: Queue,

    @Inject(LEADERBOARD_QUEUE_TOKEN)
    private readonly leaderboardQueue: Queue,

    @Inject(ADMIN_TASKS_QUEUE_TOKEN)
    private readonly adminTasksQueue: Queue,
  ) {}

  async enqueueApprovalNotification(input: ApprovalNotificationInput): Promise<Job> {
    this.logger.debug('Enqueuing approval notification', { telegramId: input.telegramId });
    const payload: SendApprovalNotificationPayload = {
      job: JobName.SEND_APPROVAL_NOTIFICATION,
      ...input,
      triggeredAt: new Date().toISOString(),
    };
    return this.telegramQueue.add(JobName.SEND_APPROVAL_NOTIFICATION, payload, {
      priority: 1,
    });
  }

  async enqueueRejectionNotification(input: RejectionNotificationInput): Promise<Job> {
    this.logger.debug('Enqueuing rejection notification', { telegramId: input.telegramId });
    const payload: SendRejectionNotificationPayload = {
      job: JobName.SEND_REJECTION_NOTIFICATION,
      ...input,
      triggeredAt: new Date().toISOString(),
    };
    return this.telegramQueue.add(JobName.SEND_REJECTION_NOTIFICATION, payload, {
      priority: 1,
    });
  }

  async enqueueLeaderboardRecalc(): Promise<Job> {
    this.logger.debug('Enqueuing leaderboard recalculation');
    return this.leaderboardQueue.add(
      JobName.RECALC_LEADERBOARD,
      { job: JobName.RECALC_LEADERBOARD, triggeredAt: new Date().toISOString() },
      {
        jobId: 'leaderboard-recalc',
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async getQueueStats(): Promise<{
    notifications: Record<string, number>;
    leaderboard: Record<string, number>;
    adminTasks: Record<string, number>;
  }> {
    const [notifCounts, lbCounts, adminCounts] = await Promise.all([
      this.getQueueCounts(this.telegramQueue),
      this.getQueueCounts(this.leaderboardQueue),
      this.getQueueCounts(this.adminTasksQueue),
    ]);

    return {
      notifications: notifCounts,
      leaderboard: lbCounts,
      adminTasks: adminCounts,
    };
  }

  private async getQueueCounts(queue: Queue): Promise<Record<string, number>> {
    const counts = await queue.getJobCounts();
    return counts as Record<string, number>;
  }
}
