import { Test, type TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OutboxService } from '../../outbox/outbox.service';
import { UsageThresholdService } from './usage-threshold.service';

const mockPinoLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  setContext: jest.fn(),
};

describe('UsageThresholdService', () => {
  let service: UsageThresholdService;
  let prisma: { $transaction: jest.Mock };
  let outbox: { emit: jest.Mock };

  beforeEach(async () => {
    outbox = { emit: jest.fn() };
    prisma = { $transaction: jest.fn((fn) => fn(prisma)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageThresholdService,
        { provide: PrismaService, useValue: prisma },
        { provide: OutboxService, useValue: outbox },
        { provide: PinoLogger, useValue: mockPinoLogger },
      ],
    }).compile();

    service = module.get<UsageThresholdService>(UsageThresholdService);
  });

  describe('checkThreshold', () => {
    it('does not crash when called with valid parameters', async () => {
      // The method should not throw when no transaction is available
      await expect(
        service.checkThreshold('company-1', 'api_calls', 80, 100),
      ).resolves.toBeUndefined();
    });

    it('emits outbox event when threshold band reached', async () => {
      outbox.emit.mockResolvedValue(undefined);

      await service.checkThreshold('company-1', 'api_calls', 95, 100);

      expect(outbox.emit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventType: 'UsageThresholdReached',
        }),
      );
    });

    it('does not emit for values below 80% threshold', async () => {
      await service.checkThreshold('company-1', 'api_calls', 50, 100);

      expect(outbox.emit).not.toHaveBeenCalled();
    });
  });
});
