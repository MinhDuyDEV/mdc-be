import * as nodemailer from 'nodemailer';
import type { MailerTransporter } from './mailer.constants';
import { MailerService } from './mailer.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('MailerService', () => {
  let service: MailerService;
  let mockTransporter: jest.MockedObject<MailerTransporter>;
  let mockConfigService: { get: jest.Mock };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          emailFrom: 'test@example.com',
        };
        return config[key];
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('with streamTransport', () => {
    beforeEach(() => {
      mockTransporter = {
        verify: false,
        sendMail: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.MockedObject<MailerTransporter>;

      (jest.mocked(nodemailer.createTransport) as jest.Mock).mockImplementation(
        () => mockTransporter,
      );

      service = new MailerService(mockTransporter, mockConfigService as never);
    });

    it('sendMail resolves with streamTransport', async () => {
      await service.sendMail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });
    });

    it('verifyConnection guards against streamTransport (typeof check)', async () => {
      await expect(service.verifyConnection()).resolves.toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTransporter.verify).toBe(false);
    });
  });

  describe('with real transporter', () => {
    beforeEach(() => {
      mockTransporter = {
        verify: jest.fn().mockResolvedValue(true),
        sendMail: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.MockedObject<MailerTransporter>;

      (jest.mocked(nodemailer.createTransport) as jest.Mock).mockImplementation(
        () => mockTransporter,
      );

      service = new MailerService(mockTransporter, mockConfigService as never);
    });

    it('sendMail resolves with real transporter (mocked)', async () => {
      await service.sendMail({
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      });
    });

    it('verifyConnection calls transporter.verify() for real transporter', async () => {
      await service.verifyConnection();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockTransporter.verify).toHaveBeenCalled();
    });
  });
});
