import { z } from 'zod';

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WORKER_API_URL: z.string().url().default('http://localhost:3001'),
  WORKER_API_INTERNAL_SECRET: z.string().min(16),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_NAME: z.string().default('Domusbet Referral'),
  // Concurrency settings
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  WORKER_MAX_STALLED_COUNT: z.coerce.number().default(3),
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHANNEL_ID: z.string().min(1, 'TELEGRAM_CHANNEL_ID is required'),
  BOT_USERNAME: z.string().min(1, 'BOT_USERNAME is required'),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function validateWorkerEnv(env: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('Invalid Worker environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data!;
}
