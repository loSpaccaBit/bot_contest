import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-001',
    domusbetUsername: 'mario123',
    status: 'PENDING',
    referrerId: 'ref-001',
    referrer: {
      id: 'ref-001',
      telegramId: '111222333',
    },
    reviewedById: null,
    reviewedAt: null,
    adminNotes: null,
    rejectionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrismaSubmission = {
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
};

const mockPrismaScoreRule = {
  findUnique: vi.fn(),
};

const mockPrismaScoreMovement = {
  create: vi.fn(),
  aggregate: vi.fn().mockResolvedValue({ _sum: { points: 10 } }),
  groupBy: vi.fn(),
};

const mockPrismaSubmissionEvent = {
  create: vi.fn(),
  findMany: vi.fn(),
};

const mockPrismaAuditLog = {
  create: vi.fn(),
};

// executeTransaction calls the callback with a transaction client
const txClient = {
  submission: mockPrismaSubmission,
  submissionEvent: mockPrismaSubmissionEvent,
  scoreMovement: mockPrismaScoreMovement,
  auditLog: mockPrismaAuditLog,
  scoreRule: mockPrismaScoreRule,
};

const mockPrisma = {
  submission: mockPrismaSubmission,
  submissionEvent: mockPrismaSubmissionEvent,
  scoreMovement: mockPrismaScoreMovement,
  auditLog: mockPrismaAuditLog,
  scoreRule: mockPrismaScoreRule,
  executeTransaction: vi.fn((fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient)),
  isPrismaUniqueConstraintError: vi.fn(() => false),
  isPrismaNotFoundError: vi.fn(() => false),
  $transaction: vi.fn((fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient)),
};

const mockAuditService = {
  log: vi.fn().mockResolvedValue(undefined),
};

const mockReferrersService = {
  findOrCreateByTelegramId: vi.fn(),
};

const mockQueuesService = {
  enqueueApprovalNotification: vi.fn().mockResolvedValue(undefined),
  enqueueRejectionNotification: vi.fn().mockResolvedValue(undefined),
  enqueueLeaderboardRecalc: vi.fn().mockResolvedValue(undefined),
};

// ─── Factory ──────────────────────────────────────────────────────────────────

function buildService(): SubmissionsService {
  return new SubmissionsService(
    mockPrisma as any,
    mockAuditService as any,
    mockReferrersService as any,
    mockQueuesService as any,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SubmissionsService', () => {
  let service: SubmissionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = buildService();
  });

  // ── createFromBot ────────────────────────────────────────────────────────

  describe('createFromBot()', () => {
    const createDto = {
      domusbetUsername: 'Mario123',
      telegramId: '111222333',
      telegramUsername: 'mario_tg',
      firstName: 'Mario',
      lastName: 'Rossi',
    };

    const referrer = { id: 'ref-001', telegramId: '111222333' };

    it('creates a submission successfully when no duplicate exists', async () => {
      const expectedSub = makeSubmission({ domusbetUsername: 'mario123' });

      mockPrismaSubmission.findFirst.mockResolvedValueOnce(null);
      mockReferrersService.findOrCreateByTelegramId.mockResolvedValueOnce(referrer);
      mockPrismaSubmission.create.mockResolvedValueOnce(expectedSub);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});

      const result = await service.createFromBot(createDto);

      expect(result).toEqual(expectedSub);
      expect(mockPrismaSubmission.findFirst).toHaveBeenCalledOnce();
      expect(mockPrismaSubmission.create).toHaveBeenCalledOnce();
    });

    it('normalizes the username to lowercase before duplicate check', async () => {
      mockPrismaSubmission.findFirst.mockResolvedValueOnce(null);
      mockReferrersService.findOrCreateByTelegramId.mockResolvedValueOnce(referrer);
      mockPrismaSubmission.create.mockResolvedValueOnce(makeSubmission());
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});

      await service.createFromBot({ ...createDto, domusbetUsername: '  @Mario123  ' });

      const findFirstCall = mockPrismaSubmission.findFirst.mock.calls[0][0];
      expect(findFirstCall.where.domusbetUsername).toBe('mario123');
    });

    it('throws ConflictException when the username has already been submitted', async () => {
      const existing = makeSubmission({ status: 'PENDING' });
      mockPrismaSubmission.findFirst.mockResolvedValueOnce(existing);

      await expect(service.createFromBot(createDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaSubmission.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException for previously approved username', async () => {
      const existing = makeSubmission({ status: 'APPROVED' });
      mockPrismaSubmission.findFirst.mockResolvedValueOnce(existing);

      await expect(service.createFromBot(createDto)).rejects.toThrow(ConflictException);
    });

    it('creates a submission event within the transaction (received notification is inline)', async () => {
      mockPrismaSubmission.findFirst.mockResolvedValueOnce(null);
      mockReferrersService.findOrCreateByTelegramId.mockResolvedValueOnce(referrer);
      mockPrismaSubmission.create.mockResolvedValueOnce(makeSubmission());
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});

      await service.createFromBot(createDto);

      expect(mockPrismaSubmissionEvent.create).toHaveBeenCalledOnce();
    });

    it('creates a SubmissionEvent within the transaction', async () => {
      mockPrismaSubmission.findFirst.mockResolvedValueOnce(null);
      mockReferrersService.findOrCreateByTelegramId.mockResolvedValueOnce(referrer);
      mockPrismaSubmission.create.mockResolvedValueOnce(makeSubmission());
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});

      await service.createFromBot(createDto);

      expect(mockPrismaSubmissionEvent.create).toHaveBeenCalledOnce();
    });
  });

  // ── approve ──────────────────────────────────────────────────────────────

  describe('approve()', () => {
    const adminId = 'admin-001';
    const approveDto = { adminNotes: 'Looks good' };

    it('approves a PENDING submission and returns the updated record', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({ status: 'APPROVED', reviewedById: adminId });

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      const result = await service.approve('sub-001', approveDto, adminId);

      expect(result.status).toBe('APPROVED');
      expect(result.reviewedById).toBe(adminId);
    });

    it('creates an audit log entry during approval', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({ status: 'APPROVED', reviewedById: adminId });

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      await service.approve('sub-001', approveDto, adminId);

      expect(mockPrismaAuditLog.create).toHaveBeenCalledOnce();
      const auditCall = mockPrismaAuditLog.create.mock.calls[0][0];
      expect(auditCall.data.adminId).toBe(adminId);
      expect(auditCall.data.action).toMatch(/approve/i);
    });

    it('creates a ScoreMovement when a scoreRuleId is provided', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({ status: 'APPROVED', reviewedById: adminId });
      const scoreRule = { id: 'rule-001', isActive: true, points: 10 };

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaScoreRule.findUnique.mockResolvedValueOnce(scoreRule);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaScoreMovement.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      await service.approve('sub-001', { ...approveDto, scoreRuleId: 'rule-001' }, adminId);

      expect(mockPrismaScoreMovement.create).toHaveBeenCalledOnce();
      const movementCall = mockPrismaScoreMovement.create.mock.calls[0][0];
      expect(movementCall.data.points).toBe(10);
      expect(movementCall.data.submissionId).toBe('sub-001');
    });

    it('enqueues leaderboard recalculation when a score rule is applied', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({ status: 'APPROVED', reviewedById: adminId });
      const scoreRule = { id: 'rule-001', isActive: true, points: 10 };

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaScoreRule.findUnique.mockResolvedValueOnce(scoreRule);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaScoreMovement.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      await service.approve('sub-001', { ...approveDto, scoreRuleId: 'rule-001' }, adminId);

      expect(mockQueuesService.enqueueLeaderboardRecalc).toHaveBeenCalledOnce();
    });

    it('throws NotFoundException when submission does not exist', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(null);

      await expect(service.approve('non-existent', approveDto, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when submission is already APPROVED', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(
        makeSubmission({ status: 'APPROVED' }),
      );

      await expect(service.approve('sub-001', approveDto, adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when submission is already REJECTED', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(
        makeSubmission({ status: 'REJECTED' }),
      );

      await expect(service.approve('sub-001', approveDto, adminId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the scoreRuleId references a non-existent rule', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(makeSubmission());
      mockPrismaScoreRule.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.approve('sub-001', { scoreRuleId: 'missing-rule' }, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the score rule is inactive', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(makeSubmission());
      mockPrismaScoreRule.findUnique.mockResolvedValueOnce({
        id: 'rule-001',
        isActive: false,
        points: 5,
      });

      await expect(
        service.approve('sub-001', { scoreRuleId: 'rule-001' }, adminId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── reject ───────────────────────────────────────────────────────────────

  describe('reject()', () => {
    const adminId = 'admin-001';

    it('rejects a PENDING submission successfully', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({
        status: 'REJECTED',
        reviewedById: adminId,
        rejectionReason: 'Duplicate account',
      });

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      const result = await service.reject(
        'sub-001',
        { rejectionReason: 'Duplicate account' },
        adminId,
      );

      expect(result.status).toBe('REJECTED');
      expect(result.rejectionReason).toBe('Duplicate account');
    });

    it('stores the rejection reason on the submission record', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({
        status: 'REJECTED',
        rejectionReason: 'Account does not meet criteria',
      });

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      await service.reject('sub-001', { rejectionReason: 'Account does not meet criteria' }, adminId);

      const updateCall = mockPrismaSubmission.update.mock.calls[0][0];
      expect(updateCall.data.rejectionReason).toBe('Account does not meet criteria');
    });

    it('creates an audit log entry during rejection', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({ status: 'REJECTED' });

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      await service.reject('sub-001', { rejectionReason: 'Test' }, adminId);

      expect(mockPrismaAuditLog.create).toHaveBeenCalledOnce();
      const auditCall = mockPrismaAuditLog.create.mock.calls[0][0];
      expect(auditCall.data.action).toMatch(/reject/i);
      expect(auditCall.data.details).toMatchObject({ rejectionReason: 'Test' });
    });

    it('enqueues a Telegram rejection notification', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({ status: 'REJECTED' });

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      await service.reject('sub-001', { rejectionReason: 'Spam' }, adminId);

      expect(mockQueuesService.enqueueRejectionNotification).toHaveBeenCalledOnce();
      expect(mockQueuesService.enqueueRejectionNotification).toHaveBeenCalledWith(
        expect.objectContaining({ rejectionReason: 'Spam' }),
      );
    });

    it('throws NotFoundException when submission does not exist', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.reject('non-existent', { rejectionReason: 'Test' }, adminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when submission is already APPROVED', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(makeSubmission({ status: 'APPROVED' }));

      await expect(
        service.reject('sub-001', { rejectionReason: 'Test' }, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when submission is already REJECTED', async () => {
      mockPrismaSubmission.findUnique.mockResolvedValueOnce(
        makeSubmission({ status: 'REJECTED' }),
      );

      await expect(
        service.reject('sub-001', { rejectionReason: 'Test' }, adminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not create a ScoreMovement when rejecting', async () => {
      const submission = makeSubmission();
      const updated = makeSubmission({ status: 'REJECTED' });

      mockPrismaSubmission.findUnique.mockResolvedValueOnce(submission);
      mockPrismaSubmission.update.mockResolvedValueOnce(updated);
      mockPrismaSubmissionEvent.create.mockResolvedValueOnce({});
      mockPrismaAuditLog.create.mockResolvedValueOnce({});

      await service.reject('sub-001', { rejectionReason: 'Invalid' }, adminId);

      expect(mockPrismaScoreMovement.create).not.toHaveBeenCalled();
      expect(mockQueuesService.enqueueLeaderboardRecalc).not.toHaveBeenCalled();
    });
  });
});
