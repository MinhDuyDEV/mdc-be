import { jest } from '@jest/globals';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let passwordService: any;
  let tokenService: any;
  let emailVerificationService: any;
  let outboxService: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => {
        return cb({
          user: {
            create: jest.fn(),
          },
          auditLog: {
            create: jest.fn(),
          },
        });
      }),
    };
    passwordService = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    tokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
    };
    emailVerificationService = {
      generateToken: jest.fn(),
    };
    outboxService = {
      emit: jest.fn(),
    };

    service = new AuthService(
      prisma,
      passwordService,
      tokenService,
      emailVerificationService,
      outboxService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should create user with hashed password', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const hashedPassword = '$2b$12$...';
      const createdUser = {
        id: 'user-123',
        email: dto.email,
        passwordHash: hashedPassword,
        displayName: null,
        emailVerifiedAt: null,
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.findUnique.mockResolvedValue(null);
      passwordService.hash.mockResolvedValue(hashedPassword);
      emailVerificationService.generateToken.mockResolvedValue(
        'verification-token',
      );

      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => {
          return cb({
            user: { create: (() => createdUser) as any },
            auditLog: { create: jest.fn() },
          });
        },
      );

      const result = await service.register(dto);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: dto.email,
        }),
      );
      expect(passwordService.hash).toHaveBeenCalledWith(dto.password);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      const dto = { email: 'existing@example.com', password: 'password123' };

      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: dto.email,
      } as any);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return token pair for valid credentials', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const accessToken = 'access.token.jwt';
      const refreshToken = 'refresh-uuid';
      const familyId = 'family-uuid';

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: dto.email,
        passwordHash: '$2b$12$hash',
        displayName: null,
        status: 'ACTIVE',
      } as any);
      passwordService.compare.mockResolvedValue(true);
      tokenService.generateAccessToken.mockResolvedValue(accessToken);
      tokenService.generateRefreshToken.mockResolvedValue({
        token: refreshToken,
        familyId,
      });

      const result = await service.login(dto);

      expect(result).toEqual({
        accessToken,
        refreshToken,
        user: {
          id: 'user-123',
          email: dto.email,
          emailVerifiedAt: undefined,
        },
      });
      expect(tokenService.generateAccessToken).toHaveBeenCalledWith(
        'user-123',
        dto.email,
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      const dto = { email: 'test@example.com', password: 'wrong' };

      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: dto.email,
        passwordHash: '$2b$12$hash',
        displayName: null,
        status: 'ACTIVE',
      } as any);
      passwordService.compare.mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'no@user.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for disabled user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: '$2b$12$hash',
        displayName: null,
        status: 'DISABLED',
      } as any);

      await expect(
        service.login({ email: 'test@example.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should update many refresh tokens', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await service.revokeAllUserSessions('user-1');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
