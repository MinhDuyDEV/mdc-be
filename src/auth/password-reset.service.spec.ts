import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { MAILER_TRANSPORTER } from '../infra/mailer/mailer.constants';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PasswordService } from './password.service';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let prisma: PrismaService;
  let passwordService: PasswordService;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            verificationToken: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            refreshToken: {
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn(),
            compare: jest.fn(),
          },
        },
        {
          provide: TokenService,
          useValue: {
            revokeRefreshToken: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                appBaseUrl: 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
        {
          provide: MAILER_TRANSPORTER,
          useValue: mockMailerService,
        },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
    prisma = module.get<PrismaService>(PrismaService);
    passwordService = module.get<PasswordService>(PasswordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestReset', () => {
    it('should return success for non-existent email (no user enumeration)', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);

      const result = await service.requestReset('nonexistent@example.com');

      expect(result).toEqual({ message: expect.any(String) });
      // Should NOT create any token
      expect(prisma.verificationToken.create).not.toHaveBeenCalled();
    });

    it('should create a reset token for existing user', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const tokenHash = 'hashed-token';

      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: userId,
        email,
      } as any);
      jest.spyOn(passwordService, 'hash').mockResolvedValue(tokenHash);
      jest
        .spyOn(prisma.verificationToken, 'create')
        .mockResolvedValue({ id: 'vt-1' } as any);

      const result = await service.requestReset(email);

      expect(result).toEqual({ message: expect.any(String) });
      expect(prisma.verificationToken.create).toHaveBeenCalled();
    });
  });

  describe('confirmReset', () => {
    it('should throw BadRequestException for expired token', async () => {
      const storedToken = {
        id: 'vt-1',
        userId: 'user-123',
        type: 'PASSWORD_RESET' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() - 1000), // expired
        usedAt: null,
        createdAt: new Date(),
      };

      jest
        .spyOn(prisma.verificationToken, 'findFirst')
        .mockResolvedValue(storedToken);

      await expect(
        service.confirmReset('some-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for already-used token', async () => {
      const storedToken = {
        id: 'vt-1',
        userId: 'user-123',
        type: 'PASSWORD_RESET' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: new Date(), // already used
        createdAt: new Date(),
      };

      jest
        .spyOn(prisma.verificationToken, 'findFirst')
        .mockResolvedValue(storedToken);

      await expect(
        service.confirmReset('some-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update password and revoke sessions on valid token', async () => {
      const userId = 'user-123';
      const newPassword = 'newPassword123';
      const newHash = 'new-password-hash';

      const storedToken = {
        id: 'vt-1',
        userId,
        type: 'PASSWORD_RESET' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        createdAt: new Date(),
      };

      jest
        .spyOn(prisma.verificationToken, 'findFirst')
        .mockResolvedValue(storedToken);
      jest.spyOn(passwordService, 'compare').mockResolvedValue(true);
      jest.spyOn(passwordService, 'hash').mockResolvedValue(newHash);
      jest
        .spyOn(prisma.verificationToken, 'update')
        .mockResolvedValue({} as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({} as any);
      jest
        .spyOn(prisma.refreshToken, 'updateMany')
        .mockResolvedValue({ count: 1 });

      const result = await service.confirmReset('valid-token', newPassword);

      expect(result).toEqual({ message: expect.any(String) });
      expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({ passwordHash: newHash }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          data: { revokedAt: expect.any(Date) },
        }),
      );
    });
  });
});
