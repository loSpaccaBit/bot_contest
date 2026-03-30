import { Module, Inject, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QueuesService } from './queues.service';
import {
  TELEGRAM_NOTIFICATION_QUEUE,
  LEADERBOARD_QUEUE,
  ADMIN_TASKS_QUEUE,
  TELEGRAM_QUEUE_TOKEN,
  LEADERBOARD_QUEUE_TOKEN,
  ADMIN_TASKS_QUEUE_TOKEN,
  BULL_REDIS_CONNECTION,
} from './queues.constants';

export {
  TELEGRAM_NOTIFICATION_QUEUE,
  LEADERBOARD_QUEUE,
  ADMIN_TASKS_QUEUE,
};

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: BULL_REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
          maxRetriesPerRequest: null,
          enableReadyCheck: false,
          lazyConnect: true,
        }),
    },
    {
      provide: TELEGRAM_QUEUE_TOKEN,
      inject: [BULL_REDIS_CONNECTION],
      useFactory: (connection: Redis) =>
        new Queue(TELEGRAM_NOTIFICATION_QUEUE, { connection }),
    },
    {
      provide: LEADERBOARD_QUEUE_TOKEN,
      inject: [BULL_REDIS_CONNECTION],
      useFactory: (connection: Redis) =>
        new Queue(LEADERBOARD_QUEUE, { connection }),
    },
    {
      provide: ADMIN_TASKS_QUEUE_TOKEN,
      inject: [BULL_REDIS_CONNECTION],
      useFactory: (connection: Redis) =>
        new Queue(ADMIN_TASKS_QUEUE, { connection }),
    },
    QueuesService,
  ],
  exports: [QueuesService],
})
export class QueuesModule implements OnModuleDestroy {
  constructor(
    @Inject(TELEGRAM_QUEUE_TOKEN) private readonly telegramQueue: Queue,
    @Inject(LEADERBOARD_QUEUE_TOKEN) private readonly leaderboardQueue: Queue,
    @Inject(ADMIN_TASKS_QUEUE_TOKEN) private readonly adminQueue: Queue,
    @Inject(BULL_REDIS_CONNECTION) private readonly redis: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.telegramQueue.close(),
      this.leaderboardQueue.close(),
      this.adminQueue.close(),
    ]);
    this.redis.disconnect();
  }
}
