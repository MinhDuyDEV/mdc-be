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
    // Public-profile lookup has been delegated to ProfilesService. See
    // src/profiles/profiles.service.ts and the users.controller tests.
  });
});
