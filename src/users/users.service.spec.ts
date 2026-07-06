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
    const mockDate = new Date();

    it('should return user profile with role flags and memberships', async () => {
      const user = { id: 'user-123', email: 'test@example.com' };
      const dbProfile = {
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        emailVerifiedAt: mockDate,
        status: 'ACTIVE' as const,
        createdAt: mockDate,
        adminUser: {
          role: 'ADMIN' as const,
          permissions: [
            { permission: 'MANAGE_USERS' as const },
            { permission: 'MANAGE_COMPANIES' as const },
          ],
        },
        companyMembers: [
          {
            role: 'OWNER' as const,
            company: { id: 'c-1', name: 'Acme Inc', slug: 'acme-inc' },
          },
        ],
        recruiterSeats: [],
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(dbProfile as any);

      const result = await service.getOwnProfile(user);
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        emailVerifiedAt: mockDate,
        status: 'ACTIVE',
        createdAt: mockDate,
        isSuperAdmin: false,
        isAdmin: true,
        isModerator: true,
        adminPermissions: ['MANAGE_USERS', 'MANAGE_COMPANIES'],
        companyMemberships: [
          {
            companyId: 'c-1',
            companyName: 'Acme Inc',
            companySlug: 'acme-inc',
            role: 'OWNER',
          },
        ],
        recruiterSeats: [],
      });
    });

    it('should return falsy flags for regular user (no adminUser, no memberships)', async () => {
      const user = { id: 'user-456', email: 'normal@example.com' };
      const dbProfile = {
        id: 'user-456',
        email: 'normal@example.com',
        displayName: null,
        emailVerifiedAt: null,
        status: 'ACTIVE' as const,
        createdAt: mockDate,
        adminUser: null,
        companyMembers: [],
        recruiterSeats: [],
      };

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(dbProfile as any);

      const result = await service.getOwnProfile(user);
      expect(result.isSuperAdmin).toBe(false);
      expect(result.isAdmin).toBe(false);
      expect(result.isModerator).toBe(false);
      expect(result.adminPermissions).toEqual([]);
      expect(result.companyMemberships).toEqual([]);
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
