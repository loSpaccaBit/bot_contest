import {
  Injectable,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { UpdateBotMessageDto } from './dto/update-bot-message.dto';
import type { BotMessageTemplate } from '@domusbet/database';

const REDIS_KEY_PREFIX = 'bot:msg:';

interface SeedTemplate {
  key: string;
  content: string;
  description?: string;
  name: string;
}

@Injectable()
export class BotMessagesService {
  private readonly logger = new Logger(BotMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async findAll(): Promise<BotMessageTemplate[]> {
    return this.prisma.botMessageTemplate.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async findById(id: string): Promise<BotMessageTemplate> {
    const message = await this.prisma.botMessageTemplate.findUnique({ where: { id } });
    if (!message) {
      throw new NotFoundException(`Bot message with ID ${id} not found`);
    }
    return message;
  }

  async findByKey(key: string): Promise<BotMessageTemplate | null> {
    return this.prisma.botMessageTemplate.findUnique({ where: { key } });
  }

  /**
   * Get a rendered message with variable substitution.
   * Variables are in the format: {{variable_name}}
   */
  async getRenderedMessage(
    key: string,
    variables: Record<string, string | number> = {},
  ): Promise<string | null> {
    const message = await this.findByKey(key);
    if (!message) return null;

    return this.parseTemplate(message.content, variables);
  }

  private parseTemplate(
    template: string,
    variables: Record<string, string | number>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
      const value = variables[varName];
      return value !== undefined ? String(value) : `{{${varName}}}`;
    });
  }

  async update(
    id: string,
    dto: UpdateBotMessageDto,
    adminId?: string,
  ): Promise<BotMessageTemplate> {
    const existing = await this.prisma.botMessageTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Bot message with ID ${id} not found`);
    }

    const message = await this.prisma.botMessageTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Push updated content to Redis so the bot picks it up immediately
    if (message.isActive) {
      await this.redis
        .set(`${REDIS_KEY_PREFIX}${existing.key}`, message.content)
        .catch((err: unknown) =>
          this.logger.warn({ err, key: existing.key }, 'Failed to update Redis cache for bot message'),
        );
    } else {
      // Message deactivated — remove from cache so the bot won't serve it
      await this.redis
        .del(`${REDIS_KEY_PREFIX}${existing.key}`)
        .catch(() => {});
    }

    if (adminId) {
      await this.auditService.log({
        adminId,
        action: 'BOT_MESSAGE_UPDATE',
        entityType: 'BotMessageTemplate',
        entityId: id,
        details: { key: existing.key },
      });
    }

    this.logger.log(`Bot message "${existing.key}" updated`);

    return message;
  }

  /**
   * Pre-loads all active bot message templates into Redis.
   * Called by the internal controller at bot startup.
   */
  async warmRedisCache(): Promise<void> {
    const templates = await this.prisma.botMessageTemplate.findMany({
      where: { isActive: true },
    });
    const pipeline = this.redis.pipeline();
    for (const t of templates) {
      pipeline.set(`${REDIS_KEY_PREFIX}${t.key}`, t.content);
    }
    await pipeline.exec();
    this.logger.log(`Warmed Redis cache with ${templates.length} bot message templates`);
  }

  async bulkSeedTemplates(templates: SeedTemplate[]): Promise<void> {
    for (const template of templates) {
      await this.prisma.botMessageTemplate.upsert({
        where: { key: template.key },
        update: {},
        create: {
          key: template.key,
          name: template.name,
          content: template.content,
          description: template.description,
        },
      });
    }
    this.logger.log(`Seeded ${templates.length} bot message templates`);
  }
}
