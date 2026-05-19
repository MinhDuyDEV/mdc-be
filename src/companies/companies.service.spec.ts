import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { CompanyRole, Industry } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let mockPrismaValue: any;
  let mockOutboxService: any;
  let mockIdempotencyService: any;

  beforeEach(async () => {
    mockPrismaValue = {
      company: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      companyMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      companyFollower: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      recruiterSeat: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      memberInvitation: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(mockPrismaValue)),
    };

    mockOutboxService = { emit: jest.fn() };
    mockIdempotencyService = {
      claim: jest.fn().mockResolvedValue({ id: 'idem-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: mockPrismaValue },
        { provide: OutboxService, useValue: mockOutboxService },
        { provide: IdempotencyService, useValue: mockIdempotencyService },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
  });

  describe('createCompany', () => {
    it('creates company with OWNER membership when email is verified', async () => {
      mockPrismaValue.user.findUnique.mockResolvedValue({
        id: 'user-1',
        emailVerifiedAt: new Date(),
      });
      mockPrismaValue.company.count.mockResolvedValue(0);
      const created = {
        id: 'company-1',
        name: 'Acme',
        slug: 'acme',
      };
      mockPrismaValue.company.create.mockResolvedValue(created);

      const result = await service.createCompany('user-1', {
        name: 'Acme',
        industry: Industry.TECHNOLOGY,
      });

      expect(mockIdempotencyService.claim).toHaveBeenCalledWith(
        'CompanyCreate',
        'user-1:Acme',
      );
      expect(mockPrismaValue.companyMember.create).toHaveBeenCalledWith({
        data: {
          companyId: 'company-1',
          userId: 'user-1',
          role: CompanyRole.OWNER,
          status: 'active',
        },
      });
      expect(mockPrismaValue.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorUserId: 'user-1',
          action: 'company.create',
          entityType: 'Company',
          entityId: 'company-1',
        }),
      });
      expect(mockOutboxService.emit).toHaveBeenCalledWith(
        mockPrismaValue,
        expect.objectContaining({
          eventType: 'CompanyCreated',
          aggregateId: 'company-1',
        }),
      );
      expect(result).toEqual(created);
    });

    it('throws ForbiddenException when email not verified (FR1)', async () => {
      mockPrismaValue.user.findUnique.mockResolvedValue({
        id: 'user-1',
        emailVerifiedAt: null,
      });

      await expect(
        service.createCompany('user-1', { name: 'Acme' }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockIdempotencyService.claim).not.toHaveBeenCalled();
      expect(mockPrismaValue.company.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrismaValue.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCompany('missing', { name: 'Acme' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('followCompany', () => {
    it('returns no-op when already following (FR7 idempotent)', async () => {
      mockPrismaValue.company.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrismaValue.companyFollower.findUnique.mockResolvedValue({
        id: 'f1',
      });

      await expect(
        service.followCompany('user-1', 'c1'),
      ).resolves.toBeUndefined();

      expect(mockPrismaValue.companyFollower.create).not.toHaveBeenCalled();
      expect(mockPrismaValue.company.update).not.toHaveBeenCalled();
    });

    it('creates follower record and increments count when not following', async () => {
      mockPrismaValue.company.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrismaValue.companyFollower.findUnique.mockResolvedValue(null);

      await service.followCompany('user-1', 'c1');

      expect(mockPrismaValue.companyFollower.create).toHaveBeenCalledWith({
        data: { companyId: 'c1', userId: 'user-1' },
      });
      expect(mockPrismaValue.company.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { followerCount: { increment: 1 } },
      });
      expect(mockOutboxService.emit).toHaveBeenCalledWith(
        mockPrismaValue,
        expect.objectContaining({ eventType: 'CompanyFollowed' }),
      );
    });

    it('throws NotFoundException when company missing or soft-deleted', async () => {
      mockPrismaValue.company.findFirst.mockResolvedValue(null);

      await expect(service.followCompany('user-1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unfollowCompany', () => {
    it('throws NotFoundException when not following', async () => {
      mockPrismaValue.company.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrismaValue.companyFollower.findUnique.mockResolvedValue(null);

      await expect(service.unfollowCompany('user-1', 'c1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes follower and decrements count', async () => {
      mockPrismaValue.company.findFirst.mockResolvedValue({ id: 'c1' });
      mockPrismaValue.companyFollower.findUnique.mockResolvedValue({
        id: 'f1',
      });

      await service.unfollowCompany('user-1', 'c1');

      expect(mockPrismaValue.companyFollower.delete).toHaveBeenCalledWith({
        where: { id: 'f1' },
      });
      expect(mockOutboxService.emit).toHaveBeenCalledWith(
        mockPrismaValue,
        expect.objectContaining({ eventType: 'CompanyUnfollowed' }),
      );
    });
  });
});
