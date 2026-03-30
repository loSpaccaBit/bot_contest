import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SubmissionStatus } from '@domusbet/database';
import { normalizeDomusbetUsername } from '@domusbet/shared-utils';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReferrersService } from '../referrers/referrers.service';
import { QueuesService } from '../queues/queues.service';
import type { CreateSubmissionFromBotDto } from './dto/create-submission.dto';
import type { ApproveSubmissionDto } from './dto/approve-submission.dto';
import type { RejectSubmissionDto } from './dto/reject-submission.dto';
import type { AssignPointsDto } from './dto/assign-points.dto';
import type { SubmissionQueryDto } from './dto/submission-query.dto';
import type { Submission, ScoreMovement } from '@domusbet/database';

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
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly referrersService: ReferrersService,
    private readonly queuesService: QueuesService,
  ) {}

  async createFromBot(dto: CreateSubmissionFromBotDto): Promise<Submission> {
    // Shared normalizer — identical logic to bot side
    const normalizedUsername = normalizeDomusbetUsername(dto.domusbetUsername);

    // Unique index lookup (no findFirst, exploits the unique constraint)
    const existing = await this.prisma.submission.findUnique({
      where: { normalizedDomusbetUsername: normalizedUsername },
    });

    if (existing) {
      throw new ConflictException(
        `Lo username "${normalizedUsername}" è già stato segnalato (stato: ${existing.status}).`,
      );
    }

    const referrer = await this.referrersService.findOrCreateByTelegramId(dto.telegramId, {
      telegramUsername: dto.telegramUsername,
      firstName: dto.firstName,
      lastName: dto.lastName,
    });

    // Atomic: create submission + initial event
    const submission = await this.prisma.executeTransaction(async (tx) => {
      const sub = await tx.submission.create({
        data: {
          referrerId: referrer.id,
          domusbetUsername: dto.domusbetUsername.trim(),
          normalizedDomusbetUsername: normalizedUsername,
          status: SubmissionStatus.PENDING,
        },
      });

      await tx.submissionEvent.create({
        data: {
          submissionId: sub.id,
          eventType: 'CREATED',
          actorId: referrer.telegramId,
          actorType: 'referrer',
          payload: {
            originalUsername: dto.domusbetUsername,
            normalizedUsername,
            telegramId: dto.telegramId,
          },
        },
      });

      return sub;
    });

    // submission-received notification is handled by the bot inline (via text.handler)

    this.logger.log(
      `Submission created: ${normalizedUsername} by Telegram ${referrer.telegramId}`,
    );

    return submission;
  }

  async findAll(query: SubmissionQueryDto = {}): Promise<PaginatedResult<Submission>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    // Safe search: normalize before comparing
    const safeSearch = query.search?.trim();

    const where = {
      ...(query.status && { status: query.status }),
      ...(query.referrerId && { referrerId: query.referrerId }),
      ...(safeSearch && {
        OR: [
          {
            normalizedDomusbetUsername: {
              contains: safeSearch.toLowerCase(),
              mode: 'insensitive' as const,
            },
          },
          {
            referrer: {
              OR: [
                { telegramUsername: { contains: safeSearch, mode: 'insensitive' as const } },
                { firstName: { contains: safeSearch, mode: 'insensitive' as const } },
              ],
            },
          },
        ],
      }),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(new Date(query.dateTo).setHours(23, 59, 59, 999)) }),
            },
          }
        : {}),
      ...(query.hasPoints === true && !query.scoreRuleCode && { scoreMovements: { some: {} } }),
      ...(query.hasPoints === false && { scoreMovements: { none: {} } }),
      ...(query.scoreRuleCode && {
        scoreMovements: {
          some: {
            scoreRule: { code: query.scoreRuleCode },
          },
        },
      }),
    };

    const allowedSortFields = ['createdAt', 'updatedAt', 'status', 'domusbetUsername', 'reviewedAt'];
    const sortBy = allowedSortFields.includes(query.sortBy ?? '') ? query.sortBy! : 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    const [items, total] = await Promise.all([
      this.prisma.submission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          referrer: {
            select: {
              id: true,
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              lastName: true,
            },
          },
          reviewedBy: {
            select: { id: true, displayName: true, email: true },
          },
          scoreMovements: { select: { points: true } },
        },
      }),
      this.prisma.submission.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data: items.map((item) => ({
        id: item.id,
        domusbetUsername: item.domusbetUsername,
        normalizedDomusbetUsername: item.normalizedDomusbetUsername,
        status: item.status,
        referrerId: item.referrerId,
        referrerTelegramId: (item as typeof item & { referrer?: { telegramId: string } }).referrer?.telegramId,
        referrerFirstName: (item as typeof item & { referrer?: { firstName: string | null } }).referrer?.firstName,
        reviewedById: item.reviewedById,
        reviewedByName: (item as typeof item & { reviewedBy?: { displayName: string } | null }).reviewedBy?.displayName,
        reviewedAt: item.reviewedAt,
        adminNotes: item.adminNotes,
        rejectionReason: item.rejectionReason,
        totalPoints: ((item as typeof item & { scoreMovements?: Array<{ points: number }> }).scoreMovements ?? []).reduce((s, m) => s + m.points, 0),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async findById(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        referrer: {
          select: { id: true, telegramId: true, telegramUsername: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, displayName: true, email: true },
        },
        events: { orderBy: { createdAt: 'asc' } },
        scoreMovements: {
          select: {
            id: true,
            points: true,
            reason: true,
            scoreRuleId: true,
            scoreRule: { select: { name: true, code: true } },
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${id}" non trovata.`);
    }

    return {
      id: submission.id,
      domusbetUsername: submission.domusbetUsername,
      normalizedDomusbetUsername: submission.normalizedDomusbetUsername,
      status: submission.status,
      referrerId: submission.referrerId,
      referrerTelegramId: submission.referrer?.telegramId,
      referrerFirstName: submission.referrer?.firstName,
      reviewedById: submission.reviewedById,
      reviewedByName: submission.reviewedBy?.displayName,
      reviewedAt: submission.reviewedAt,
      adminNotes: submission.adminNotes,
      rejectionReason: submission.rejectionReason,
      totalPoints: submission.scoreMovements.reduce((s, m) => s + m.points, 0),
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      events: submission.events,
      scoreMovements: submission.scoreMovements.map((m) => ({
        id: m.id,
        points: m.points,
        reason: m.reason,
        scoreRuleName: (m as typeof m & { scoreRule?: { name: string; code: string } | null }).scoreRule?.name ?? null,
        scoreRuleCode: (m as typeof m & { scoreRule?: { name: string; code: string } | null }).scoreRule?.code ?? null,
        createdAt: m.createdAt,
      })),
    };
  }

  async approve(id: string, dto: ApproveSubmissionDto, adminId: string): Promise<Submission> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { referrer: true },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${id}" non trovata.`);
    }

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException(
        `La segnalazione è già in stato ${submission.status} e non può essere approvata.`,
      );
    }

    let scorePoints: number | null = null;
    if (dto.scoreRuleId) {
      const rule = await this.prisma.scoreRule.findUnique({ where: { id: dto.scoreRuleId } });
      if (!rule) {
        throw new NotFoundException(`Score rule "${dto.scoreRuleId}" non trovata.`);
      }
      if (!rule.isActive) {
        throw new BadRequestException(`Score rule "${dto.scoreRuleId}" non è attiva.`);
      }
      scorePoints = rule.points;
    }

    const updated = await this.prisma.executeTransaction(async (tx) => {
      const result = await tx.submission.update({
        where: { id },
        data: {
          status: SubmissionStatus.APPROVED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          adminNotes: dto.adminNotes ?? null,
        },
        include: { referrer: true },
      });

      await tx.submissionEvent.create({
        data: {
          submissionId: id,
          eventType: 'STATUS_CHANGED',
          actorId: adminId,
          actorType: 'admin',
          payload: {
            from: SubmissionStatus.PENDING,
            to: SubmissionStatus.APPROVED,
            adminNotes: dto.adminNotes ?? null,
            scoreRuleId: dto.scoreRuleId ?? null,
            scorePoints: scorePoints,
          },
        },
      });

      if (dto.scoreRuleId && scorePoints !== null) {
        await tx.scoreMovement.create({
          data: {
            referrerId: submission.referrerId,
            submissionId: id,
            scoreRuleId: dto.scoreRuleId,
            adminId,
            points: scorePoints,
            reason: "Punti assegnati automaticamente all'approvazione",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          adminId,
          action: 'SUBMISSION_APPROVED',
          entityType: 'Submission',
          entityId: id,
          details: {
            domusbetUsername: submission.normalizedDomusbetUsername,
            referrerId: submission.referrerId,
            scoreRuleId: dto.scoreRuleId ?? null,
            pointsAssigned: scorePoints,
          },
        },
      });

      return result;
    });

    const totalPoints = await this.prisma.scoreMovement.aggregate({
      where: { referrerId: submission.referrerId },
      _sum: { points: true },
    });
    this.queuesService
      .enqueueApprovalNotification({
        telegramId: submission.referrer.telegramId,
        referrerId: submission.referrerId,
        submissionId: id,
        domusbetUsername: submission.normalizedDomusbetUsername,
        points: scorePoints ?? 0,
        totalPoints: totalPoints._sum.points ?? 0,
        firstName: submission.referrer.firstName,
      })
      .catch((err: unknown) =>
        this.logger.error({ err }, 'Failed to enqueue approval notification'),
      );

    if (scorePoints !== null) {
      this.queuesService
        .enqueueLeaderboardRecalc()
        .catch((err: unknown) =>
          this.logger.error({ err }, 'Failed to enqueue leaderboard recalc'),
        );
    }

    this.logger.log(`Submission ${id} approved by admin ${adminId}`);
    return updated as unknown as Submission;
  }

  async reject(id: string, dto: RejectSubmissionDto, adminId: string): Promise<Submission> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { referrer: true },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${id}" non trovata.`);
    }

    if (submission.status !== SubmissionStatus.PENDING) {
      throw new BadRequestException(
        `La segnalazione è già in stato ${submission.status} e non può essere rifiutata.`,
      );
    }

    const updated = await this.prisma.executeTransaction(async (tx) => {
      const result = await tx.submission.update({
        where: { id },
        data: {
          status: SubmissionStatus.REJECTED,
          reviewedById: adminId,
          reviewedAt: new Date(),
          rejectionReason: dto.rejectionReason,
          adminNotes: dto.adminNotes ?? null,
        },
        include: { referrer: true },
      });

      await tx.submissionEvent.create({
        data: {
          submissionId: id,
          eventType: 'STATUS_CHANGED',
          actorId: adminId,
          actorType: 'admin',
          payload: {
            from: SubmissionStatus.PENDING,
            to: SubmissionStatus.REJECTED,
            rejectionReason: dto.rejectionReason,
            adminNotes: dto.adminNotes ?? null,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          action: 'SUBMISSION_REJECTED',
          entityType: 'Submission',
          entityId: id,
          details: {
            domusbetUsername: submission.normalizedDomusbetUsername,
            rejectionReason: dto.rejectionReason,
          },
        },
      });

      return result;
    });

    this.queuesService
      .enqueueRejectionNotification({
        telegramId: submission.referrer.telegramId,
        submissionId: id,
        domusbetUsername: submission.normalizedDomusbetUsername,
        rejectionReason: dto.rejectionReason,
        firstName: submission.referrer.firstName,
      })
      .catch((err: unknown) =>
        this.logger.error({ err }, 'Failed to enqueue rejection notification'),
      );

    this.logger.log(`Submission ${id} rejected by admin ${adminId}`);
    return updated as unknown as Submission;
  }

  async getSubmissionEvents(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${submissionId}" non trovata.`);
    }

    return this.prisma.submissionEvent.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async assignPoints(id: string, dto: AssignPointsDto, adminId: string): Promise<ScoreMovement> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { referrer: true },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${id}" non trovata.`);
    }

    if (submission.status !== SubmissionStatus.APPROVED) {
      throw new BadRequestException(
        'I punti possono essere assegnati solo a segnalazioni approvate.',
      );
    }

    const rule = await this.prisma.scoreRule.findUnique({ where: { code: dto.scoreRuleCode } });
    if (!rule) {
      throw new NotFoundException(`Score rule "${dto.scoreRuleCode}" non trovata.`);
    }
    if (!rule.isActive) {
      throw new BadRequestException(`Score rule "${dto.scoreRuleCode}" non è attiva.`);
    }

    const points = dto.customPoints ?? rule.points;

    const movement = await this.prisma.executeTransaction(async (tx) => {
      const mv = await tx.scoreMovement.create({
        data: {
          referrerId: submission.referrerId,
          submissionId: id,
          scoreRuleId: rule.id,
          adminId,
          points,
          reason: dto.reason ?? rule.name,
        },
      });

      await tx.submissionEvent.create({
        data: {
          submissionId: id,
          eventType: 'POINTS_ASSIGNED',
          actorId: adminId,
          actorType: 'admin',
          payload: {
            points,
            reason: dto.reason ?? null,
            scoreRuleId: rule.id,
            scoreRuleCode: dto.scoreRuleCode,
            scoreRuleName: rule.name,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          action: 'SUBMISSION_POINTS_ASSIGNED',
          entityType: 'Submission',
          entityId: id,
          details: {
            points,
            reason: dto.reason ?? null,
            referrerId: submission.referrerId,
            scoreRuleId: rule.id,
            scoreRuleCode: dto.scoreRuleCode,
          },
        },
      });

      return mv;
    });

    this.queuesService
      .enqueueLeaderboardRecalc()
      .catch((err: unknown) =>
        this.logger.error({ err }, 'Failed to enqueue leaderboard recalc'),
      );

    return movement;
  }

  async unapprove(id: string, adminId: string): Promise<Submission> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: { referrer: true },
    });

    if (!submission) {
      throw new NotFoundException(`Submission "${id}" non trovata.`);
    }

    if (submission.status !== SubmissionStatus.APPROVED) {
      throw new BadRequestException(
        `La segnalazione è in stato ${submission.status} e non può essere riportata in attesa.`,
      );
    }

    const updated = await this.prisma.executeTransaction(async (tx) => {
      const result = await tx.submission.update({
        where: { id },
        data: {
          status: SubmissionStatus.PENDING,
          reviewedById: null,
          reviewedAt: null,
          adminNotes: null,
        },
        include: { referrer: true },
      });

      await tx.submissionEvent.create({
        data: {
          submissionId: id,
          eventType: 'STATUS_CHANGED',
          actorId: adminId,
          actorType: 'admin',
          payload: {
            from: SubmissionStatus.APPROVED,
            to: SubmissionStatus.PENDING,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          action: 'SUBMISSION_UNAPPROVED',
          entityType: 'Submission',
          entityId: id,
          details: {
            domusbetUsername: submission.normalizedDomusbetUsername,
            referrerId: submission.referrerId,
          },
        },
      });

      return result;
    });

    this.logger.log(`Submission ${id} unapproved by admin ${adminId}`);
    return updated as unknown as Submission;
  }

  async deleteScoreMovement(submissionId: string, movementId: string, adminId: string): Promise<void> {
    const movement = await this.prisma.scoreMovement.findUnique({
      where: { id: movementId },
    });

    if (!movement) {
      throw new NotFoundException(`Movimento punti "${movementId}" non trovato.`);
    }

    if (movement.submissionId !== submissionId) {
      throw new BadRequestException('Il movimento non appartiene a questa segnalazione.');
    }

    await this.prisma.executeTransaction(async (tx) => {
      await tx.scoreMovement.delete({ where: { id: movementId } });

      await tx.submissionEvent.create({
        data: {
          submissionId,
          eventType: 'POINTS_ASSIGNED',
          actorId: adminId,
          actorType: 'admin',
          payload: {
            deleted: true,
            points: -movement.points,
            reason: 'Annullamento assegnazione punti',
            originalMovementId: movementId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          action: 'SUBMISSION_POINTS_REMOVED',
          entityType: 'Submission',
          entityId: submissionId,
          details: {
            movementId,
            points: movement.points,
            reason: movement.reason,
          },
        },
      });
    });

    this.queuesService
      .enqueueLeaderboardRecalc()
      .catch((err: unknown) =>
        this.logger.error({ err }, 'Failed to enqueue leaderboard recalc'),
      );

    this.logger.log(`ScoreMovement ${movementId} deleted by admin ${adminId}`);
  }
}
