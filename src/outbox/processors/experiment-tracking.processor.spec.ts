import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { ExperimentTrackingProcessor } from './experiment-tracking.processor';

describe('ExperimentTrackingProcessor', () => {
  let processor: ExperimentTrackingProcessor;
  let prisma: jest.Mocked<PrismaService>;

  const mockPayload = {
    experimentId: 'exp-homepage-v2',
    userId: 'user-123',
    variant: 'treatment-a',
    timestamp: '2026-06-12T00:00:00.000Z',
  };

  beforeEach(async () => {
    prisma = {
      experimentImpression: {
        create: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExperimentTrackingProcessor,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    processor = module.get<ExperimentTrackingProcessor>(
      ExperimentTrackingProcessor,
    );
  });

  it('creates an experiment impression record', async () => {
    await processor.process(mockPayload);

    expect(prisma.experimentImpression.create).toHaveBeenCalledWith({
      data: {
        experimentId: 'exp-homepage-v2',
        userId: 'user-123',
        variant: 'treatment-a',
        impressedAt: new Date('2026-06-12T00:00:00.000Z'),
      },
    });
  });

  it('handles duplicate key error idempotently', async () => {
    const prismaError = Object.assign(new Error('Unique violation'), {
      code: 'P2002',
    });
    (prisma.experimentImpression.create as jest.Mock).mockRejectedValue(
      prismaError,
    );

    await expect(processor.process(mockPayload)).resolves.toBeUndefined();
  });

  it('rethrows non-duplicate errors', async () => {
    const dbError = new Error('Connection lost');
    (prisma.experimentImpression.create as jest.Mock).mockRejectedValue(
      dbError,
    );

    await expect(processor.process(mockPayload)).rejects.toThrow(
      'Connection lost',
    );
  });
});
