import { z } from 'zod';

const botEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  BOT_WEBHOOK_URL: z.string().url().optional(),
  BOT_API_URL: z.string().url().default('http://localhost:3001'),
  BOT_API_INTERNAL_SECRET: z.string().min(16),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_NAME: z.string().default('Domusbet Referral'),
});

export type BotEnv = z.infer<typeof botEnvSchema>;

export function validateBotEnv(env: NodeJS.ProcessEnv = process.env): BotEnv {
  const result = botEnvSchema.safeParse(env);
  if (!result.success) {
    console.error('Invalid Bot environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data!;
}
