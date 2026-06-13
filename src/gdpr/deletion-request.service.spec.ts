import {
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../infra/prisma/prisma.service';
import { DeletionRequestService } from './deletion-request.service';

describe('DeletionRequestService', () => {
  let service: DeletionRequestService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  const mockDeletionRequest = {
    id: 'req-1',
    userId: 'user-1',
    requestedBy: 'user-1',
    reason: null,
    status: 'PENDING_ERASURE',
    scheduledFor: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    dueBy: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      deletionRequest: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletionRequestService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DeletionRequestService>(DeletionRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDeletionRequest', () => {
    it('should create a new deletion request', async () => {
      prisma.deletionRequest.findFirst.mockResolvedValue(null);
      prisma.deletionRequest.create.mockResolvedValue(mockDeletionRequest);

      const result = await service.createDeletionRequest('user-1', 'user-1');
      expect(result).toEqual(mockDeletionRequest);
      expect(prisma.deletionRequest.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if pending request exists', async () => {
      prisma.deletionRequest.findFirst.mockResolvedValue(mockDeletionRequest);

      await expect(
        service.createDeletionRequest('user-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cancelRequest', () => {
    it('should cancel a pending deletion request', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockDeletionRequest);
      prisma.deletionRequest.update = jest.fn().mockResolvedValue({
        ...mockDeletionRequest,
        status: 'CANCELLED',
        cancelledAt: new Date(),
      });

      const result = await service.cancelRequest('req-1', 'user-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw ForbiddenException when cancelling another user request', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockDeletionRequest);

      await expect(service.cancelRequest('req-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException for non-pending request', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue({
        ...mockDeletionRequest,
        status: 'IN_PROGRESS',
      });

      await expect(service.cancelRequest('req-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('should return a deletion request by id', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(mockDeletionRequest);

      const result = await service.findById('req-1');
      expect(result).toEqual(mockDeletionRequest);
    });

    it('should return null if not found', async () => {
      prisma.deletionRequest.findUnique.mockResolvedValue(null);

      const result = await service.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findOverdueRequests', () => {
    it('should return overdue requests', async () => {
      prisma.deletionRequest.findMany.mockResolvedValue([mockDeletionRequest]);

      const result = await service.findOverdueRequests();
      expect(result).toHaveLength(1);
      expect(prisma.deletionRequest.findMany).toHaveBeenCalled();
    });
  });
});
