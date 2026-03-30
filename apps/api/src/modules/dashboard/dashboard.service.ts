import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { DashboardMetricsDto, LeaderboardEntryDto, RecentActivityDto } from '@domusbet/shared-types';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMetrics(): Promise<DashboardMetricsDto> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      submissionCounts,
      todayCount,
      weekCount,
      monthCount,
      referrerCounts,
      pointsResult,
      topReferrerPoints,
      recentSubmissions,
    ] = await Promise.all([
      this.prisma.submission.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.submission.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.submission.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.submission.count({ where: { createdAt: { gte: startOfMonth } } }),
      Promise.all([
        this.prisma.referrer.count(),
        this.prisma.referrer.count({ where: { isActive: true } }),
      ]),
      this.prisma.scoreMovement.aggregate({ _sum: { points: true } }),
      this.prisma.scoreMovement.groupBy({
        by: ['referrerId'],
        _sum: { points: true },
        orderBy: { _sum: { points: 'desc' } },
        take: 5,
      }),
      this.prisma.submission.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          referrer: {
            select: { telegramId: true, telegramUsername: true, firstName: true },
          },
        },
      }),
    ]);

    const submissionMap = submissionCounts.reduce(
      (acc, row) => {
        acc[row.status] = row._count.status;
        return acc;
      },
      {} as Record<string, number>,
    );

    const [totalReferrers, activeReferrers] = referrerCounts;

    // Enrich top referrers with details
    const topReferrerIds = topReferrerPoints.map((r) => r.referrerId);
    const [topReferrerDetails, approvedCounts] = await Promise.all([
      this.prisma.referrer.findMany({
        where: { id: { in: topReferrerIds } },
        select: { id: true, telegramId: true, telegramUsername: true, firstName: true },
      }),
      this.prisma.submission.groupBy({
        by: ['referrerId'],
        where: { referrerId: { in: topReferrerIds }, status: 'APPROVED' },
        _count: { id: true },
      }),
    ]);

    const referrerDetailMap = Object.fromEntries(topReferrerDetails.map((r) => [r.id, r]));
    const approvedMap = Object.fromEntries(
      approvedCounts.map((row) => [row.referrerId, row._count.id]),
    );

    const topReferrers: LeaderboardEntryDto[] = topReferrerPoints.map((row, idx) => {
      const d = referrerDetailMap[row.referrerId];
      return {
        rank: idx + 1,
        referrerId: row.referrerId,
        telegramId: d?.telegramId ?? 'unknown',
        telegramUsername: d?.telegramUsername ?? null,
        firstName: d?.firstName ?? null,
        totalPoints: row._sum.points ?? 0,
        approvedSubmissions: approvedMap[row.referrerId] ?? 0,
      };
    });

    // Map recent submissions to RecentActivityDto
    const recentActivity: RecentActivityDto[] = recentSubmissions.map((sub) => ({
      id: sub.id,
      type:
        sub.status === 'APPROVED'
          ? 'submission_approved'
          : sub.status === 'REJECTED'
            ? 'submission_rejected'
            : 'submission_created',
      submissionId: sub.id,
      referrerId: sub.referrerId,
      referrerFirstName: sub.referrer.firstName ?? null,
      domusbetUsername: sub.normalizedDomusbetUsername,
      timestamp: sub.createdAt,
    }));

    return {
      totalSubmissions: Object.values(submissionMap).reduce((a, b) => a + b, 0),
      pendingSubmissions: submissionMap['PENDING'] ?? 0,
      approvedSubmissions: submissionMap['APPROVED'] ?? 0,
      rejectedSubmissions: submissionMap['REJECTED'] ?? 0,
      totalReferrers,
      activeReferrers,
      totalPointsAwarded: pointsResult._sum.points ?? 0,
      submissionsToday: todayCount,
      submissionsThisWeek: weekCount,
      submissionsThisMonth: monthCount,
      topReferrers,
      recentActivity,
    };
  }
}
