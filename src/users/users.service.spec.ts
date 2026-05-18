import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../infra/prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOwnProfile', () => {
    it('should return user profile with safe fields', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const profile = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: null,
        emailVerifiedAt: null,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(profile as any);

      const result = await service.getOwnProfile(user);
      expect(result).toEqual(profile);
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(
        service.getOwnProfile({ id: 'nonexistent', email: 'x@x.com' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOwnProfile', () => {
    it('should update displayName', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const updated = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'New Name',
        emailVerifiedAt: null,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
      };

      jest.spyOn(prisma.user, 'update').mockResolvedValue(updated as any);

      const result = await service.updateOwnProfile(user, {
        displayName: 'New Name',
      });
      expect(result.displayName).toBe('New Name');
    });
  });

  describe('getPublicProfile', () => {
    it('should return public fields for active user', async () => {
      const userRecord = {
        id: 'user-123',
        displayName: 'Public Name',
        status: 'ACTIVE' as const,
        createdAt: new Date(),
      };

      jest
        .spyOn(prisma.user, 'findUnique')
        .mockResolvedValue(userRecord as any);

      const result = await service.getPublicProfile('user-123');
      expect(result).toEqual({
        id: 'user-123',
        displayName: 'Public Name',
        createdAt: userRecord.createdAt,
      });
    });

    it('should throw NotFoundException for deleted user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-123',
        displayName: 'Deleted',
        status: 'DELETED' as const,
        createdAt: new Date(),
      } as any);

      await expect(service.getPublicProfile('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for disabled user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-123',
        displayName: 'Disabled',
        status: 'DISABLED' as const,
        createdAt: new Date(),
      } as any);

      await expect(service.getPublicProfile('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      await expect(service.getPublicProfile('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
