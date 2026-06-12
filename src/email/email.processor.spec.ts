import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailStatus } from '@prisma/client';
import { EmailProcessor } from './email.processor';
import { PrismaService } from '../infra/prisma/prisma.service';
import { MAILER_TRANSPORTER } from '../infra/mailer/mailer.constants';
import { EmailService } from './email.service';
import { EmailTrackingService } from './email-tracking.service';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    emailDelivery: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };
  let mailerService: { sendMail: jest.Mock };
  let trackingService: jest.Mocked<EmailTrackingService>;

  const mockDelivery = {
    id: 'ed-1',
    to: 'user@example.com',
    subject: 'Welcome',
    template: 'email-verification',
    context: { name: 'Test' },
    attempts: 0,
    status: 'PENDING' as const,
    sentAt: null,
    failedAt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mailerService = { sendMail: jest.fn() };

    trackingService = {
      recordOpen: jest.fn(),
      recordClick: jest.fn(),
      unsubscribe: jest.fn(),
      getOpenTrackingUrl: jest
        .fn()
        .mockReturnValue('https://mdc.local/api/v1/email/track/open/ed-1'),
      getClickTrackingUrl: jest
        .fn()
        .mockReturnValue(
          'https://mdc.local/api/v1/email/track/click/ed-1?redirect=https%3A%2F%2Fexample.com',
        ),
      getUnsubscribeUrl: jest
        .fn()
        .mockReturnValue('https://mdc.local/api/v1/email/unsubscribe/abc'),
      hasTrackingConsent: jest.fn(),
      hasMarketingConsent: jest.fn(),
      injectTrackingPixel: jest
        .fn()
        .mockImplementation((html: string) => html + '<!--pixel-->'),
      rewriteLinks: jest
        .fn()
        .mockImplementation((html: string) =>
          html.replace(/href="http/g, 'href="https://track/'),
        ),
    } as unknown as jest.Mocked<EmailTrackingService>;

    prisma = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      emailDelivery: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      (cb: (tx: typeof prisma) => unknown) => cb(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: MAILER_TRANSPORTER,
          useValue: mailerService,
        },
        {
          provide: EmailService,
          useValue: {
            renderTemplate: jest.fn().mockReturnValue('<html>Hello</html>'),
          },
        },
        {
          provide: EmailTrackingService,
          useValue: trackingService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, unknown> = {
                emailFrom: 'test@example.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should call mailerService.sendMail and update status to SENT', async () => {
      const event = {
        id: 'ed-1',
        to: 'user@example.com',
        subject: 'Welcome',
        template: 'email-verification',
        context: { name: 'Test' },
      };

      mailerService.sendMail.mockResolvedValue({ messageId: 'abc-123' });

      await processor.process(event);

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@example.com',
          to: event.to,
          subject: event.subject,
        }),
      );
      expect(prisma.emailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: EmailStatus.SENT }),
        }),
      );
    });
  });

  describe('pollPending', () => {
    it('should do nothing when no pending emails', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await processor.pollPending();

      expect(prisma.emailDelivery.findMany).not.toHaveBeenCalled();
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should process pending email and inject tracking when consent exists', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-1' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([mockDelivery]);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      trackingService.hasTrackingConsent.mockResolvedValue(true);
      mailerService.sendMail.mockResolvedValue({ messageId: 'abc-123' });

      await processor.pollPending();

      // Tracking should be injected
      expect(trackingService.injectTrackingPixel).toHaveBeenCalled();
      expect(trackingService.rewriteLinks).toHaveBeenCalled();

      // Mail should be sent
      expect(mailerService.sendMail).toHaveBeenCalled();
    });

    it('should NOT inject tracking when no consent', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-1' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([mockDelivery]);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      trackingService.hasTrackingConsent.mockResolvedValue(false);
      mailerService.sendMail.mockResolvedValue({ messageId: 'abc-123' });

      await processor.pollPending();

      // Tracking should NOT be injected
      expect(trackingService.injectTrackingPixel).not.toHaveBeenCalled();
      expect(trackingService.rewriteLinks).not.toHaveBeenCalled();

      // Mail should still be sent
      expect(mailerService.sendMail).toHaveBeenCalled();
    });

    it('should add unsubscribe link when user is found', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-1' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([mockDelivery]);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      trackingService.hasTrackingConsent.mockResolvedValue(false);
      mailerService.sendMail.mockResolvedValue({ messageId: 'abc-123' });

      await processor.pollPending();

      expect(trackingService.getUnsubscribeUrl).toHaveBeenCalledWith('user-1');
    });

    it('should not add unsubscribe link when user is not found', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-1' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([mockDelivery]);
      prisma.user.findUnique.mockResolvedValue(null);
      mailerService.sendMail.mockResolvedValue({ messageId: 'abc-123' });

      await processor.pollPending();

      expect(trackingService.getUnsubscribeUrl).not.toHaveBeenCalled();
    });

    it('should process pending email and mark as SENT on success', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-1' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([mockDelivery]);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      trackingService.hasTrackingConsent.mockResolvedValue(false);
      mailerService.sendMail.mockResolvedValue({ messageId: 'abc-123' });

      await processor.pollPending();

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@example.com',
          to: mockDelivery.to,
          subject: mockDelivery.subject,
        }),
      );
      expect(prisma.emailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ed-1' },
          data: expect.objectContaining({ status: EmailStatus.SENT }),
        }),
      );
    });

    it('should increment attempts on failure and mark FAILED when exhausted', async () => {
      const exhaustedDelivery = { ...mockDelivery, id: 'ed-2', attempts: 2 };
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-2' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([exhaustedDelivery]);
      mailerService.sendMail.mockRejectedValue(new Error('SMTP error'));

      await processor.pollPending();

      expect(prisma.emailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ed-2' },
          data: expect.objectContaining({
            attempts: 3,
            status: EmailStatus.FAILED,
            errorMessage: 'SMTP error',
          }),
        }),
      );
    });

    it('should increment attempts without FAILED status when not exhausted', async () => {
      const retryDelivery = { ...mockDelivery, id: 'ed-3', attempts: 0 };
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-3' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([retryDelivery]);
      mailerService.sendMail.mockRejectedValue(new Error('Temporary error'));

      await processor.pollPending();

      expect(prisma.emailDelivery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ed-3' },
          data: expect.objectContaining({
            attempts: 1,
            errorMessage: 'Temporary error',
          }),
        }),
      );
      // Status should NOT be FAILED since attempts < 3
      const updateCall = prisma.emailDelivery.update.mock.calls[0][0];
      expect(updateCall.data.status).toBeUndefined();
    });

    it('should still send email when user lookup fails', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-1' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([mockDelivery]);
      prisma.user.findUnique.mockResolvedValue(null);
      mailerService.sendMail.mockResolvedValue({ messageId: 'abc-123' });

      await processor.pollPending();

      expect(mailerService.sendMail).toHaveBeenCalled();
      expect(trackingService.injectTrackingPixel).not.toHaveBeenCalled();
      expect(trackingService.getUnsubscribeUrl).not.toHaveBeenCalled();
    });
  });
});
