import { Test, type TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { BillingUsageFlushService } from './billing-usage-flush.service';
import { UsageTrackerService } from './usage-tracker.service';

const mockPinoLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

describe('BillingUsageFlushService', () => {
  let service: BillingUsageFlushService;
  let mockUsageTracker: any;

  beforeEach(async () => {
    mockUsageTracker = {
      flushDailyUsage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingUsageFlushService,
        { provide: UsageTrackerService, useValue: mockUsageTracker },
        { provide: PinoLogger, useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get<BillingUsageFlushService>(BillingUsageFlushService);
  });

  describe('handleDailyUsageFlush', () => {
    it('calls usageTracker.flushDailyUsage', async () => {
      await service.handleDailyUsageFlush();

      expect(mockUsageTracker.flushDailyUsage).toHaveBeenCalled();
    });
  });
});
