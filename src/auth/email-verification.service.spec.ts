import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { MAILER_TRANSPORTER } from '../infra/mailer/mailer.constants';
import { PrismaService } from '../infra/prisma/prisma.service';
import { PasswordService } from './password.service';
import { EmailVerificationService } from './email-verification.service';

describe('EmailVerificationService', () => {
  let service: EmailVerificationService;
  let prisma: PrismaService;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationService,
        {
          provide: PrismaService,
          useValue: {
            verificationToken: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
              findMany: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
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
        {
          provide: PasswordService,
          useValue: { compare: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<EmailVerificationService>(EmailVerificationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generate', () => {
    it('should generate a 64-char hex verification token and store it', async () => {
      const userId = 'user-123';

      jest
        .spyOn(prisma.verificationToken, 'create')
        .mockResolvedValue({ id: 'vt-1' } as any);

      const token = await service.generateToken(userId);

      expect(token).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
      expect(prisma.verificationToken.create).toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('should mark email as verified for valid token', async () => {
      const userId = 'user-123';
      const rawToken = 'a'.repeat(64);
      const storedToken = {
        id: 'vt-1',
        userId,
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash: createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        createdAt: new Date(),
      };

      jest
        .spyOn(prisma.verificationToken, 'findMany')
        .mockResolvedValue([storedToken]);
      jest
        .spyOn(prisma.verificationToken, 'update')
        .mockResolvedValue({} as any);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({} as any);

      const result = await service.verifyToken(rawToken);

      expect(result).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
        }),
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      jest.spyOn(prisma.verificationToken, 'findMany').mockResolvedValue([]);

      await expect(service.verifyToken('invalid')).rejects.toThrow(
        'Invalid or expired verification token',
      );
    });
  });
});
