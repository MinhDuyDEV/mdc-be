import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailStatus } from '@prisma/client';
import { EmailProcessor } from './email.processor';
import { PrismaService } from '../infra/prisma/prisma.service';
import { MAILER_TRANSPORTER } from '../infra/mailer/mailer.constants';
import { EmailService } from './email.service';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let prisma: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    emailDelivery: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let mailerService: { sendMail: jest.Mock };

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

    prisma = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      emailDelivery: {
        findMany: jest.fn(),
        update: jest.fn(),
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

    it('should process pending email and mark as SENT on success', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'ed-1' }]);
      prisma.emailDelivery.findMany.mockResolvedValue([mockDelivery]);
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
  });
});
