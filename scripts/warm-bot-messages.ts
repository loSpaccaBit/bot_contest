import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:password@localhost:5432/domusbet_referral';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const KEY_PREFIX = 'bot:msg:';

async function main() {
  const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
  const redis = new Redis(REDIS_URL);

  try {
    const templates = await prisma.botMessageTemplate.findMany();

    console.log(`Found ${templates.length} bot message templates`);

    const pipeline = redis.pipeline();
    for (const t of templates) {
      if (t.isActive) {
        pipeline.set(`${KEY_PREFIX}${t.key}`, t.content);
        console.log(`  SET ${KEY_PREFIX}${t.key} (active)`);
      } else {
        pipeline.del(`${KEY_PREFIX}${t.key}`);
        console.log(`  DEL ${KEY_PREFIX}${t.key} (inactive)`);
      }
    }

    await pipeline.exec();
    console.log('\nDone. All bot messages loaded into Redis.');
  } finally {
    await prisma.$disconnect();
    redis.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
