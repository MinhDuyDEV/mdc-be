import type { PrismaService } from '../infra/prisma/prisma.service';
import { ConnectionsPolicyService } from './connections-policy.service';

interface MockPrisma {
  connection: { findFirst: jest.Mock };
  block: { findFirst: jest.Mock };
  follow: { findFirst: jest.Mock };
}

describe('ConnectionsPolicyService', () => {
  let prisma: MockPrisma;
  let service: ConnectionsPolicyService;

  beforeEach(() => {
    prisma = {
      connection: { findFirst: jest.fn() },
      block: { findFirst: jest.fn() },
      follow: { findFirst: jest.fn() },
    };
    service = new ConnectionsPolicyService(prisma as unknown as PrismaService);
  });

  describe('areConnected', () => {
    it('returns true when ACCEPTED connection exists (A→B)', async () => {
      prisma.connection.findFirst.mockResolvedValue({ id: 'conn-1' });
      const result = await service.areConnected('user-a', 'user-b');
      expect(result).toBe(true);
    });

    it('returns false when no connection exists', async () => {
      prisma.connection.findFirst.mockResolvedValue(null);
      const result = await service.areConnected('user-a', 'user-b');
      expect(result).toBe(false);
    });
  });

  describe('isBlocked', () => {
    it('returns true when A blocked B', async () => {
      prisma.block.findFirst.mockResolvedValue({ id: 'block-1' });
      const result = await service.isBlocked('user-a', 'user-b');
      expect(result).toBe(true);
    });

    it('returns true when B blocked A (bidirectional)', async () => {
      // isBlocked checks BOTH directions via OR, so any block match returns true
      prisma.block.findFirst.mockResolvedValue({ id: 'block-1' });
      const result = await service.isBlocked('user-a', 'user-b');
      expect(result).toBe(true);
    });

    it('returns false when no block exists', async () => {
      prisma.block.findFirst.mockResolvedValue(null);
      const result = await service.isBlocked('user-a', 'user-b');
      expect(result).toBe(false);
    });

    it('uses a symmetric OR covering both blocker directions (defensive invariant)', async () => {
      // Lock the symmetry invariant: any future regression that drops one
      // direction (e.g. removing the reverse OR) will break this test.
      prisma.block.findFirst.mockResolvedValue(null);
      await service.isBlocked('user-a', 'user-b');

      expect(prisma.block.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                blockerId: 'user-a',
                blockedId: 'user-b',
              }),
              expect.objectContaining({
                blockerId: 'user-b',
                blockedId: 'user-a',
              }),
            ]),
          }),
        }),
      );
    });
  });

  describe('isFollowing', () => {
    it('returns true when ACTIVE follow exists', async () => {
      prisma.follow.findFirst.mockResolvedValue({ id: 'follow-1' });
      const result = await service.isFollowing('user-a', 'user-b');
      expect(result).toBe(true);
    });

    it('returns false when no follow exists', async () => {
      prisma.follow.findFirst.mockResolvedValue(null);
      const result = await service.isFollowing('user-a', 'user-b');
      expect(result).toBe(false);
    });
  });
});
