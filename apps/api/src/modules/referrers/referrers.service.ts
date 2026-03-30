import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateReferrerDto } from './dto/create-referrer.dto';
import { UpdateReferrerDto } from './dto/update-referrer.dto';
import { ReferrerQueryDto } from './dto/referrer-query.dto';
import type { Referrer } from '@domusbet/database';

interface ReferrerStats {
  totalSubmissions: number;
  approvedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  totalPoints: number;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

@Injectable()
export class ReferrersService {
  private readonly logger = new Logger(ReferrersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findOrCreateByTelegramId(
    telegramId: string,
    data: Omit<CreateReferrerDto, 'telegramId'>,
  ): Promise<Referrer> {
    const existing = await this.prisma.referrer.findUnique({
      where: { telegramId },
    });

    if (existing) {
      // Update profile data if provided
      return this.prisma.referrer.update({
        where: { telegramId },
        data: {
          telegramUsername: data.telegramUsername ?? existing.telegramUsername,
          firstName: data.firstName ?? existing.firstName,
          lastName: data.lastName ?? existing.lastName,
        },
      });
    }

    const referrer = await this.prisma.referrer.create({
      data: {
        telegramId,
        telegramUsername: data.telegramUsername,
        firstName: data.firstName,
        lastName: data.lastName,
        isActive: true,
      },
    });

    this.logger.log(`New referrer registered: ${telegramId}`);
    return referrer;
  }

  async findAll(query: ReferrerQueryDto = {}): Promise<PaginatedResult<Referrer>> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where = {
      ...(query.search && {
        OR: [
          { telegramUsername: { contains: query.search, mode: 'insensitive' as const } },
          { firstName: { contains: query.search, mode: 'insensitive' as const } },
          { lastName: { contains: query.search, mode: 'insensitive' as const } },
          { telegramId: { contains: query.search } },
        ],
      }),
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const allowedSortFields = ['createdAt', 'updatedAt', 'telegramUsername'];
    const sortBy = allowedSortFields.includes(query.sortBy ?? '')
      ? query.sortBy!
      : 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.referrer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.referrer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Batch-compute stats for all referrers in this page
    const referrerIds = items.map((r) => r.id);
    const [scoreSums, submissionCounts] = await Promise.all([
      this.prisma.scoreMovement.groupBy({
        by: ['referrerId'],
        where: { referrerId: { in: referrerIds } },
        _sum: { points: true },
      }),
      this.prisma.submission.groupBy({
        by: ['referrerId', 'status'],
        where: { referrerId: { in: referrerIds } },
        _count: { id: true },
      }),
    ]);

    const scoreMap = Object.fromEntries(scoreSums.map((r) => [r.referrerId, r._sum.points ?? 0]));
    const submMap: Record<string, Record<string, number>> = {};
    for (const row of submissionCounts) {
      submMap[row.referrerId] ??= {};
      submMap[row.referrerId][row.status] = row._count.id;
    }

    return {
      data: items.map((r) => {
        const sm = submMap[r.id] ?? {};
        const approved = sm['APPROVED'] ?? 0;
        const pending = sm['PENDING'] ?? 0;
        const rejected = sm['REJECTED'] ?? 0;
        return {
          ...r,
          totalPoints: scoreMap[r.id] ?? 0,
          totalSubmissions: approved + pending + rejected,
          approvedSubmissions: approved,
          pendingSubmissions: pending,
          rejectedSubmissions: rejected,
        };
      }),
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async findById(id: string): Promise<Referrer & { stats: ReferrerStats }> {
    const referrer = await this.prisma.referrer.findUnique({
      where: { id },
    });

    if (!referrer) {
      throw new NotFoundException(`Referrer with ID ${id} not found`);
    }

    const stats = await this.getReferrerStats(id);

    return { ...referrer, stats };
  }

  async findByTelegramId(telegramId: string): Promise<Referrer | null> {
    return this.prisma.referrer.findUnique({ where: { telegramId } });
  }

  async update(id: string, dto: UpdateReferrerDto): Promise<Referrer> {
    const existing = await this.prisma.referrer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Referrer with ID ${id} not found`);
    }

    return this.prisma.referrer.update({
      where: { id },
      data: dto,
    });
  }

  async deactivate(id: string, adminId: string): Promise<Referrer> {
    const existing = await this.prisma.referrer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Referrer with ID ${id} not found`);
    }

    const referrer = await this.prisma.referrer.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      adminId,
      action: 'REFERRER_DEACTIVATE',
      entityType: 'Referrer',
      entityId: id,
      details: { telegramId: existing.telegramId },
    });

    return referrer;
  }

  async getReferrerStatsByTelegramId(telegramId: string): Promise<ReferrerStats & {
    id: string;
    telegramId: string;
    telegramUsername: string | null;
    firstName: string | null;
    rank: number;
  }> {
    const referrer = await this.prisma.referrer.findUnique({ where: { telegramId } });
    if (!referrer) {
      throw new NotFoundException(`Referrer with telegramId "${telegramId}" non trovato.`);
    }

    const stats = await this.getReferrerStats(referrer.id);

    // Compute rank: count referrers with strictly more points
    const allPoints = await this.prisma.scoreMovement.groupBy({
      by: ['referrerId'],
      _sum: { points: true },
    });

    const myPoints = stats.totalPoints;
    const rank = allPoints.filter((r) => (r._sum.points ?? 0) > myPoints).length + 1;

    return {
      id: referrer.id,
      telegramId: referrer.telegramId,
      telegramUsername: referrer.telegramUsername,
      firstName: referrer.firstName,
      rank,
      ...stats,
    };
  }

  async getChannelLink(telegramId: string): Promise<string | null> {
    const referrer = await this.prisma.referrer.findUnique({ where: { telegramId } });
    if (!referrer) {
      throw new NotFoundException(`Referrer con telegramId "${telegramId}" non trovato.`);
    }
    return referrer.channelInviteLink ?? null;
  }

  async saveChannelLink(
    telegramId: string,
    channelInviteLink: string,
    channelInviteLinkId: string,
  ): Promise<string> {
    const referrer = await this.prisma.referrer.findUnique({ where: { telegramId } });
    if (!referrer) {
      throw new NotFoundException(`Referrer con telegramId "${telegramId}" non trovato.`);
    }
    const updated = await this.prisma.referrer.update({
      where: { telegramId },
      data: { channelInviteLink, channelInviteLinkId },
    });
    return updated.channelInviteLink!;
  }

  async getReferrerStats(referrerId: string): Promise<ReferrerStats> {
    const [submissionCounts, pointsResult] = await Promise.all([
      this.prisma.submission.groupBy({
        by: ['status'],
        where: { referrerId },
        _count: { status: true },
      }),
      this.prisma.scoreMovement.aggregate({
        where: { referrerId },
        _sum: { points: true },
      }),
    ]);

    const countMap = submissionCounts.reduce(
      (acc, row) => {
        acc[row.status] = row._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalSubmissions: Object.values(countMap).reduce((a, b) => a + b, 0),
      approvedSubmissions: countMap['APPROVED'] ?? 0,
      pendingSubmissions: countMap['PENDING'] ?? 0,
      rejectedSubmissions: countMap['REJECTED'] ?? 0,
      totalPoints: pointsResult._sum.points ?? 0,
    };
  }
}
