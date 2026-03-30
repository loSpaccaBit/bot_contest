import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReferrersService } from './referrers.service';

const mockPrismaReferrer = {
  findUnique: vi.fn(),
  update: vi.fn(),
};

const mockPrisma = {
  referrer: mockPrismaReferrer,
  submission: { groupBy: vi.fn().mockResolvedValue([]) },
  scoreMovement: { aggregate: vi.fn().mockResolvedValue({ _sum: { points: 0 } }) },
};

const mockAuditService = { log: vi.fn() };

function makeService() {
  return new ReferrersService(mockPrisma as any, mockAuditService as any);
}

describe('ReferrersService.getChannelLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns channelInviteLink when referrer exists', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue({
      id: 'ref-1',
      telegramId: '111',
      channelInviteLink: 'https://t.me/+abc123',
      channelInviteLinkId: 'https://t.me/+abc123',
    });
    const service = makeService();
    const result = await service.getChannelLink('111');
    expect(result).toBe('https://t.me/+abc123');
    expect(mockPrismaReferrer.findUnique).toHaveBeenCalledWith({ where: { telegramId: '111' } });
  });

  it('returns null when referrer has no channel link', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue({
      id: 'ref-1',
      telegramId: '111',
      channelInviteLink: null,
    });
    const service = makeService();
    const result = await service.getChannelLink('111');
    expect(result).toBeNull();
  });

  it('throws NotFoundException when referrer does not exist', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue(null);
    const service = makeService();
    await expect(service.getChannelLink('999')).rejects.toThrow(NotFoundException);
  });
});

describe('ReferrersService.saveChannelLink', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves channel link and returns it', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue({ id: 'ref-1', telegramId: '111' });
    mockPrismaReferrer.update.mockResolvedValue({
      id: 'ref-1',
      channelInviteLink: 'https://t.me/+xyz',
      channelInviteLinkId: 'https://t.me/+xyz',
    });
    const service = makeService();
    const result = await service.saveChannelLink('111', 'https://t.me/+xyz', 'https://t.me/+xyz');
    expect(result).toBe('https://t.me/+xyz');
    expect(mockPrismaReferrer.update).toHaveBeenCalledWith({
      where: { telegramId: '111' },
      data: {
        channelInviteLink: 'https://t.me/+xyz',
        channelInviteLinkId: 'https://t.me/+xyz',
      },
    });
  });

  it('throws NotFoundException when referrer does not exist', async () => {
    mockPrismaReferrer.findUnique.mockResolvedValue(null);
    const service = makeService();
    await expect(service.saveChannelLink('999', 'https://t.me/+xyz', 'https://t.me/+xyz')).rejects.toThrow(NotFoundException);
  });
});
