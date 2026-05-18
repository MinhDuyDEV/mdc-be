import { OutboxProcessor } from './outbox.processor';
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */

describe('OutboxProcessor', () => {
  // Construct the processor directly, bypassing NestJS DI complexities
  function createProcessor() {
    const mockPrisma = {
      $transaction: jest.fn(),
      outboxEvent: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const mockConfig = {
      get: jest.fn((key: string) => {
        const defaults: Record<string, number> = {
          outboxBatchSize: 20,
          outboxMaxRetries: 5,
          outboxBaseBackoffMs: 1000,
          outboxMaxBackoffMs: 60000,
        };
        return defaults[key];
      }),
    };

    const processor = new OutboxProcessor(mockPrisma as any, mockConfig as any);
    return { processor, mockPrisma, mockConfig };
  }

  it('should claim events atomically via transaction', async () => {
    const { processor, mockPrisma } = createProcessor();

    const mockEvents = [
      { id: 'event-1', eventType: 'test.event', payload: { foo: 'bar' } },
    ];

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'event-1' }]),
        $executeRaw: jest.fn().mockResolvedValue(1),
        outboxEvent: {
          findMany: jest.fn().mockResolvedValue(mockEvents),
        },
      });
    });

    const claimed = await processor.claimEvents();
    expect(claimed).toHaveLength(1);
    expect(claimed[0].id).toBe('event-1');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should return empty array when no pending events', async () => {
    const { processor, mockPrisma } = createProcessor();

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      return fn({
        $queryRaw: jest.fn().mockResolvedValue([]),
        $executeRaw: jest.fn(),
        outboxEvent: { findMany: jest.fn() },
      });
    });

    const claimed = await processor.claimEvents();
    expect(claimed).toHaveLength(0);
  });

  it('should calculate exponential backoff with jitter', () => {
    const { processor } = createProcessor();

    const calcBackoff = (processor as any).calculateBackoff.bind(processor);

    const delay1 = calcBackoff(1);
    expect(delay1).toBeGreaterThanOrEqual(0);
    expect(delay1).toBeLessThanOrEqual(2000);

    const delay2 = calcBackoff(2);
    expect(delay2).toBeLessThanOrEqual(4000);

    const delay5 = calcBackoff(5);
    expect(delay5).toBeLessThanOrEqual(60000);
  });
});
