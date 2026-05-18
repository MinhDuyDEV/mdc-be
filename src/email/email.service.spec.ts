import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { PrismaService } from '../infra/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: {
            emailDelivery: {
              create: jest.fn(),
            },
          },
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
    prisma = module.get<PrismaService>(PrismaService);
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
  });
});
