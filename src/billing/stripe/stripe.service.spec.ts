import { ConfigService } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import type { AppConfig } from '../../infra/config';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;
  let configService: jest.Mocked<ConfigService<AppConfig, true>>;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockReturnValue('sk_test_mock'),
    } as unknown as jest.Mocked<ConfigService<AppConfig, true>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
  });

  describe('createCustomer', () => {
    it('creates a Stripe customer and returns object with id', async () => {
      const mockCustomers = {
        create: jest.fn().mockResolvedValue({ id: 'cus_123' }),
      };
      (service as any).stripe = { customers: mockCustomers };

      const result = await service.createCustomer({
        email: 'test@example.com',
        name: 'Test',
      });

      expect(mockCustomers.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test',
      });
      expect(result).toEqual({ id: 'cus_123' });
    });
  });

  describe('createSetupIntent', () => {
    it('creates a setup intent and returns clientSecret', async () => {
      const mockSetupIntents = {
        create: jest
          .fn()
          .mockResolvedValue({ client_secret: 'seti_secret_123' }),
      };
      (service as any).stripe = { setupIntents: mockSetupIntents };

      const result = await service.createSetupIntent('cus_123');

      expect(mockSetupIntents.create).toHaveBeenCalledWith({
        customer: 'cus_123',
      });
      expect(result).toEqual({ clientSecret: 'seti_secret_123' });
    });
  });

  describe('constructWebhookEvent', () => {
    it('calls stripe.webhooks.constructEvent', () => {
      const mockWebhooks = {
        constructEvent: jest.fn().mockReturnValue({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'pi_123' } },
          id: 'evt_123',
        }),
      };
      (service as any).stripe = { webhooks: mockWebhooks };

      const result = service.constructWebhookEvent(
        '{"raw":"body"}',
        'whsec_sig',
      );

      expect(mockWebhooks.constructEvent).toHaveBeenCalledWith(
        '{"raw":"body"}',
        'whsec_sig',
        'sk_test_mock',
      );
      expect(result).toEqual({
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
        id: 'evt_123',
      });
    });
  });
});
