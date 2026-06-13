import { Test, type TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { STRIPE_PORT } from '../ports/stripe.port';
import { UsageTrackerService } from './usage-tracker.service';

const mockPinoLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

describe('UsageTrackerService', () => {
  let service: UsageTrackerService;
  let mockStripePort: any;

  beforeEach(async () => {
    mockStripePort = {
      createUsageRecord: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageTrackerService,
        { provide: STRIPE_PORT, useValue: mockStripePort },
        { provide: PinoLogger, useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get<UsageTrackerService>(UsageTrackerService);
  });

  describe('recordUsage', () => {
    it('increments in-memory counter', async () => {
      await service.recordUsage('company-1', 'api_calls', 5);
      await service.recordUsage('company-1', 'api_calls', 3);

      const usage = (service as any).usage;
      expect(usage.get('company-1').get('api_calls')).toBe(8);
    });
  });

  describe('flushDailyUsage', () => {
    it('calls Stripe and resets counters', async () => {
      mockStripePort.createUsageRecord.mockResolvedValue({ id: 'ur_1' });

      await service.recordUsage('company-1', 'api_calls', 10);
      await service.recordUsage('company-1', 'storage_gb', 5);

      await service.flushDailyUsage();

      expect(mockStripePort.createUsageRecord).toHaveBeenCalledTimes(2);
      expect(mockStripePort.createUsageRecord).toHaveBeenCalledWith({
        customerId: 'company-1',
        meterEventName: 'api_calls',
        value: 10,
      });
      const usage = (service as any).usage;
      expect(usage.size).toBe(0);
    });

    it('does nothing when no usage recorded', async () => {
      await service.flushDailyUsage();

      expect(mockStripePort.createUsageRecord).not.toHaveBeenCalled();
    });
  });
});
