import { Test, type TestingModule } from '@nestjs/testing';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../infra/prisma';
import { ExperimentsService } from './experiments.service';

describe('ExperimentsService', () => {
  let service: ExperimentsService;
  let outbox: jest.Mocked<OutboxService>;
  let prisma: jest.Mocked<PrismaService>;

  const mockTx = {};

  beforeEach(async () => {
    outbox = {
      emit: jest.fn(),
    };

    prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => unknown) => cb(mockTx)),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentsService,
        { provide: OutboxService, useValue: outbox },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExperimentsService>(ExperimentsService);
  });

  it('emits ExperimentImpression outbox event inside a transaction', async () => {
    await service.trackEvent({
      experimentId: 'exp-homepage-v2',
      userId: 'user-123',
      variant: 'treatment-a',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(outbox.emit).toHaveBeenCalledWith(mockTx, {
      eventType: 'ExperimentImpression',
      aggregateType: 'ExperimentImpression',
      aggregateId: 'exp-homepage-v2:user-123',
      payload: expect.objectContaining({
        experimentId: 'exp-homepage-v2',
        userId: 'user-123',
        variant: 'treatment-a',
        timestamp: expect.any(String),
      }),
    });
  });
});
