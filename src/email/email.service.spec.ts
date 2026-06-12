import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: {
    emailDelivery: { create: jest.Mock };
    emailConsent: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      emailDelivery: { create: jest.fn() },
      emailConsent: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, unknown> = {
                emailFrom: 'noreply@mdc.local',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('should create EmailDelivery record and return success', async () => {
      jest.spyOn(prisma.emailDelivery, 'create').mockResolvedValue({
        id: 'ed-1',
      } as any);

      const result = await service.send({
        to: 'user@example.com',
        subject: 'Welcome',
        template: 'email-verification',
        context: { name: 'Test', link: 'http://localhost/verify' },
      });

      expect(result).toEqual({ message: 'Email queued for delivery' });
      expect(prisma.emailDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            to: 'user@example.com',
            subject: 'Welcome',
            template: 'email-verification',
          }),
        }),
      );
    });

    it('should skip job-alert email when user has unsubscribed', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-1',
      } as any);
      jest.spyOn(prisma.emailConsent, 'findUnique').mockResolvedValue({
        marketingConsent: true,
        unsubscribedAt: new Date('2026-01-01'),
      } as any);

      const result = await service.send({
        to: 'user@example.com',
        subject: 'New Jobs',
        template: 'job-alert',
        context: { jobs: [] },
      });

      expect(result).toEqual({
        message: 'Email skipped: user has unsubscribed',
      });
      expect(prisma.emailDelivery.create).not.toHaveBeenCalled();
    });

    it('should skip job-alert email when no marketing consent record', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-1',
      } as any);
      jest.spyOn(prisma.emailConsent, 'findUnique').mockResolvedValue(null);

      const result = await service.send({
        to: 'user@example.com',
        subject: 'New Jobs',
        template: 'job-alert',
        context: { jobs: [] },
      });

      expect(result).toEqual({
        message: 'Email skipped: user has unsubscribed',
      });
      expect(prisma.emailDelivery.create).not.toHaveBeenCalled();
    });

    it('should send job-alert email when user has marketing consent', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-1',
      } as any);
      jest.spyOn(prisma.emailConsent, 'findUnique').mockResolvedValue({
        marketingConsent: true,
        unsubscribedAt: null,
      } as any);
      jest.spyOn(prisma.emailDelivery, 'create').mockResolvedValue({
        id: 'ed-1',
      } as any);

      const result = await service.send({
        to: 'user@example.com',
        subject: 'New Jobs',
        template: 'job-alert',
        context: { jobs: [] },
      });

      expect(result).toEqual({ message: 'Email queued for delivery' });
      expect(prisma.emailDelivery.create).toHaveBeenCalled();
    });

    it('should send non-marketing emails without consent check', async () => {
      jest.spyOn(prisma.emailDelivery, 'create').mockResolvedValue({
        id: 'ed-1',
      } as any);

      const result = await service.send({
        to: 'user@example.com',
        subject: 'Verify Email',
        template: 'email-verification',
        context: { verificationUrl: 'http://localhost/verify' },
      });

      expect(result).toEqual({ message: 'Email queued for delivery' });
      expect(prisma.emailDelivery.create).toHaveBeenCalled();
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });
});
