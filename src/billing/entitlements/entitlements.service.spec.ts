import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../infra/prisma/prisma.service';
import { EntitlementsService } from './entitlements.service';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

interface MockPrisma {
  companyEntitlement: {
    findFirst: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    updateMany: jest.Mock;
  };
  creditTransaction: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
}

function buildMockPrisma(): MockPrisma {
  const prisma: MockPrisma = {
    companyEntitlement: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (fn: (tx: MockPrisma) => Promise<unknown>) => fn(prisma),
  );
  return prisma;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EntitlementsService', () => {
  let prisma: MockPrisma;
  let service: EntitlementsService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    service = new EntitlementsService(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // checkLimit
  // -----------------------------------------------------------------------

  describe('checkLimit', () => {
    it('returns true when credits available (creditsRemaining > 0)', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue({
        id: 'ent-1',
        creditsRemaining: 5,
      });

      const result = await service.checkLimit('company-1', 'job_posts');

      expect(result).toBe(true);
      expect(prisma.companyEntitlement.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          entitlementType: 'job_posts',
          validUntil: { gte: expect.any(Date) },
        },
      });
    });

    it('returns false when credits exhausted (creditsRemaining = 0)', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue({
        id: 'ent-1',
        creditsRemaining: 0,
      });

      const result = await service.checkLimit('company-1', 'job_posts');

      expect(result).toBe(false);
    });

    it('returns false when no entitlement found', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue(null);

      const result = await service.checkLimit('company-1', 'job_posts');

      expect(result).toBe(false);
    });

    it('returns false when entitlement expired (validUntil in past)', async () => {
      // findFirst already filters by validUntil >= now, so null means expired
      prisma.companyEntitlement.findFirst.mockResolvedValue(null);

      const result = await service.checkLimit('company-1', 'job_posts');

      expect(result).toBe(false);
      expect(prisma.companyEntitlement.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          entitlementType: 'job_posts',
          validUntil: { gte: expect.any(Date) },
        },
      });
    });
  });

  // -----------------------------------------------------------------------
  // consumeCredit
  // -----------------------------------------------------------------------

  describe('consumeCredit', () => {
    const entitlement = {
      id: 'ent-1',
      companyId: 'company-1',
      entitlementType: 'job_posts',
      creditsRemaining: 10,
      creditsUsed: 0,
      validUntil: new Date(Date.now() + 86400000),
    };

    it('atomically decrements creditsRemaining', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue(entitlement);
      prisma.companyEntitlement.updateMany.mockResolvedValue({ count: 1 });
      prisma.companyEntitlement.findUniqueOrThrow.mockResolvedValue({
        id: 'ent-1',
        creditsRemaining: 9,
      });
      prisma.creditTransaction.create.mockResolvedValue({ id: 'ct-1' });

      await service.consumeCredit('company-1', 'job_posts', 1);

      expect(prisma.companyEntitlement.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'ent-1',
          creditsRemaining: { gte: 1 },
        },
        data: {
          creditsUsed: { increment: 1 },
          creditsRemaining: { decrement: 1 },
        },
      });
    });

    it('creates CreditTransaction record', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue(entitlement);
      prisma.companyEntitlement.updateMany.mockResolvedValue({ count: 1 });
      prisma.companyEntitlement.findUniqueOrThrow.mockResolvedValue({
        id: 'ent-1',
        creditsRemaining: 9,
      });
      prisma.creditTransaction.create.mockResolvedValue({ id: 'ct-1' });

      await service.consumeCredit(
        'company-1',
        'job_posts',
        1,
        'job_post',
        'job-1',
      );

      expect(prisma.creditTransaction.create).toHaveBeenCalledWith({
        data: {
          entitlementId: 'ent-1',
          companyId: 'company-1',
          amount: -1,
          balanceAfter: 9,
          referenceType: 'job_post',
          referenceId: 'job-1',
        },
      });
    });

    it('throws ForbiddenException(ENTITLEMENT_EXCEEDED) when insufficient credits', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue(entitlement);
      // updateMany returns count 0 — optimistic concurrency guard
      prisma.companyEntitlement.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.consumeCredit('company-1', 'job_posts', 100),
      ).rejects.toThrow(new ForbiddenException('ENTITLEMENT_EXCEEDED'));
    });

    it('throws ForbiddenException(ENTITLEMENT_NOT_FOUND) when no entitlement', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue(null);

      await expect(
        service.consumeCredit('company-1', 'job_posts', 1),
      ).rejects.toThrow(new ForbiddenException('ENTITLEMENT_NOT_FOUND'));
    });

    it('returns balanceAfter', async () => {
      prisma.companyEntitlement.findFirst.mockResolvedValue(entitlement);
      prisma.companyEntitlement.updateMany.mockResolvedValue({ count: 1 });
      prisma.companyEntitlement.findUniqueOrThrow.mockResolvedValue({
        id: 'ent-1',
        creditsRemaining: 7,
      });
      prisma.creditTransaction.create.mockResolvedValue({ id: 'ct-1' });

      const balanceAfter = await service.consumeCredit(
        'company-1',
        'job_posts',
        3,
      );

      expect(balanceAfter).toBe(7); // 10 - 3
    });
  });
});
