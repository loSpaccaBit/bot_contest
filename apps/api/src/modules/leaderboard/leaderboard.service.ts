import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface LeaderboardEntry {
  rank: number;
  referrerId: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  totalPoints: number;
  approvedSubmissions: number;
}

interface LeaderboardQueryDto {
  page?: number;
  limit?: number;
}

interface PaginatedLeaderboard {
  items: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(query: LeaderboardQueryDto = {}): Promise<PaginatedLeaderboard> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(1, Number(query.limit) || 20), 100);

    // Use Prisma raw aggregation: group ScoreMovements by referrerId, sum points
    const aggregated = await this.prisma.scoreMovement.groupBy({
      by: ['referrerId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
    });

    const total = aggregated.length;

    // Get approved submission counts
    const approvedCounts = await this.prisma.submission.groupBy({
      by: ['referrerId'],
      where: { status: 'APPROVED' },
      _count: { id: true },
    });

    const approvedMap = approvedCounts.reduce(
      (acc, row) => {
        acc[row.referrerId] = row._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Paginate
    const paged = aggregated.slice((page - 1) * limit, page * limit);

    // Fetch referrer details
    const referrerIds = paged.map((r) => r.referrerId);
    const referrers = await this.prisma.referrer.findMany({
      where: { id: { in: referrerIds } },
      select: {
        id: true,
        telegramId: true,
        telegramUsername: true,
        firstName: true,
        lastName: true,
      },
    });

    const referrerMap = referrers.reduce(
      (acc, r) => {
        acc[r.id] = r;
        return acc;
      },
      {} as Record<string, (typeof referrers)[number]>,
    );

    const globalOffset = (page - 1) * limit;
    const items: LeaderboardEntry[] = paged.map((row, index) => {
      const referrer = referrerMap[row.referrerId];
      return {
        rank: globalOffset + index + 1,
        referrerId: row.referrerId,
        telegramId: referrer?.telegramId ?? 'unknown',
        telegramUsername: referrer?.telegramUsername ?? null,
        firstName: referrer?.firstName ?? null,
        lastName: referrer?.lastName ?? null,
        totalPoints: row._sum.points ?? 0,
        approvedSubmissions: approvedMap[row.referrerId] ?? 0,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getReferrerRank(telegramId: string): Promise<LeaderboardEntry | null> {
    const referrer = await this.prisma.referrer.findUnique({
      where: { telegramId },
    });

    if (!referrer) return null;

    // Get all aggregated points to determine rank
    const allPoints = await this.prisma.scoreMovement.groupBy({
      by: ['referrerId'],
      _sum: { points: true },
      orderBy: { _sum: { points: 'desc' } },
    });

    const rank = allPoints.findIndex((r) => r.referrerId === referrer.id) + 1;
    const myRow = allPoints.find((r) => r.referrerId === referrer.id);

    if (!myRow) {
      // Referrer has no score movements yet
      return {
        rank: allPoints.length + 1,
        referrerId: referrer.id,
        telegramId: referrer.telegramId,
        telegramUsername: referrer.telegramUsername,
        firstName: referrer.firstName,
        lastName: referrer.lastName,
        totalPoints: 0,
        approvedSubmissions: 0,
      };
    }

    const approvedCount = await this.prisma.submission.count({
      where: { referrerId: referrer.id, status: 'APPROVED' },
    });

    return {
      rank,
      referrerId: referrer.id,
      telegramId: referrer.telegramId,
      telegramUsername: referrer.telegramUsername,
      firstName: referrer.firstName,
      lastName: referrer.lastName,
      totalPoints: myRow._sum.points ?? 0,
      approvedSubmissions: approvedCount,
    };
  }
}
