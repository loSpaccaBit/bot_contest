import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateScoreRuleDto } from './dto/create-score-rule.dto';
import { UpdateScoreRuleDto } from './dto/update-score-rule.dto';
import type { ScoreRule, ScoreMovement } from '@domusbet/database';

interface ScoreHistoryQuery {
  page?: number;
  limit?: number;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAllRules(): Promise<ScoreRule[]> {
    return this.prisma.scoreRule.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  async findRuleById(id: string): Promise<ScoreRule> {
    const rule = await this.prisma.scoreRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException(`Score rule ${id} not found`);
    }
    return rule;
  }

  async createRule(dto: CreateScoreRuleDto, adminId?: string): Promise<ScoreRule> {
    const existing = await this.prisma.scoreRule.findFirst({
      where: { name: { equals: dto.name, mode: 'insensitive' } },
    });

    if (existing) {
      throw new ConflictException(`A score rule named "${dto.name}" already exists`);
    }

    const rule = await this.prisma.scoreRule.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        points: dto.points,
        isActive: dto.isActive ?? true,
      },
    });

    if (adminId) {
      await this.auditService.log({
        adminId,
        action: 'SCORE_RULE_CREATE',
        entityType: 'ScoreRule',
        entityId: rule.id,
        details: { name: rule.name, points: rule.points },
      });
    }

    this.logger.log(`Score rule created: ${rule.name} (${rule.points} pts)`);

    return rule;
  }

  async updateRule(
    id: string,
    dto: UpdateScoreRuleDto,
    adminId?: string,
  ): Promise<ScoreRule> {
    const existing = await this.prisma.scoreRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Score rule ${id} not found`);
    }

    if (dto.name) {
      const nameTaken = await this.prisma.scoreRule.findFirst({
        where: { name: { equals: dto.name, mode: 'insensitive' }, NOT: { id } },
      });
      if (nameTaken) {
        throw new ConflictException(`A score rule named "${dto.name}" already exists`);
      }
    }

    const rule = await this.prisma.scoreRule.update({
      where: { id },
      data: dto,
    });

    if (adminId) {
      await this.auditService.log({
        adminId,
        action: 'SCORE_RULE_UPDATE',
        entityType: 'ScoreRule',
        entityId: id,
        details: { changes: Object.keys(dto) },
      });
    }

    return rule;
  }

  async deleteRule(id: string, adminId?: string): Promise<void> {
    const existing = await this.prisma.scoreRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Score rule ${id} not found`);
    }

    // Check if this rule is referenced by score movements
    const usageCount = await this.prisma.scoreMovement.count({
      where: { scoreRuleId: id },
    });

    if (usageCount > 0) {
      // Soft-delete by deactivating rather than deleting
      await this.prisma.scoreRule.update({
        where: { id },
        data: { isActive: false },
      });
      this.logger.warn(
        `Score rule ${id} deactivated instead of deleted (has ${usageCount} movements)`,
      );
    } else {
      await this.prisma.scoreRule.delete({ where: { id } });
    }

    if (adminId) {
      await this.auditService.log({
        adminId,
        action: 'SCORE_RULE_DELETE',
        entityType: 'ScoreRule',
        entityId: id,
        details: { name: existing.name, usageCount },
      });
    }
  }

  async getReferrerTotalPoints(referrerId: string): Promise<number> {
    const result = await this.prisma.scoreMovement.aggregate({
      where: { referrerId },
      _sum: { points: true },
    });
    return result._sum.points ?? 0;
  }

  async getScoreHistory(
    referrerId: string,
    query: ScoreHistoryQuery = {},
  ): Promise<PaginatedResult<ScoreMovement>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.scoreMovement.findMany({
        where: { referrerId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          scoreRule: true,
          submission: {
            select: {
              id: true,
              domusbetUsername: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.scoreMovement.count({ where: { referrerId } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
