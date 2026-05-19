import { OutboxProcessor } from './outbox.processor';

/* eslint-disable @typescript-eslint/no-unsafe-argument */

describe('OutboxProcessor', () => {
  function createProcessor() {
    const mockPrisma = {
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(0),
      outboxEvent: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
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
          outboxLeaseTimeoutMs: 60000,
        };
        return defaults[key];
      }),
    };
    const mockDeadLetter = {
      moveToDeadLetter: jest.fn().mockResolvedValue(undefined),
    };
    const mockCompanySearchIndex = {
      processCompanyCreated: jest.fn().mockResolvedValue(undefined),
      processCompanyUpdated: jest.fn().mockResolvedValue(undefined),
    };
    const mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const processor = new OutboxProcessor(
      mockPrisma as any,
      mockConfig as any,
      mockDeadLetter as any,
      mockCompanySearchIndex as any,
      mockLogger as any,
    );
    return {
      processor,
      mockPrisma,
      mockConfig,
      mockDeadLetter,
      mockCompanySearchIndex,
      mockLogger,
    };
  }

  describe('claimEvents', () => {
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
  });

  describe('processOutbox', () => {
    it('should mark claimed events as PROCESSED on success', async () => {
      const { processor, mockPrisma } = createProcessor();

      // stale lock recovery (no stale locks)
      mockPrisma.$executeRaw.mockResolvedValue(0);

      // claimEvents: return one event
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'event-1' }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'event-1',
                eventType: 'test.event',
                payload: { data: 1 },
                attempts: 1,
              },
            ]),
          },
        });
      });

      // markProcessed
      mockPrisma.outboxEvent.update.mockResolvedValue({});

      await processor.processOutbox();

      const updateCalls = mockPrisma.outboxEvent.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
      const markProcessedCall = updateCalls.find(
        (call: any) => call[0].data?.status === 'PROCESSED',
      );
      expect(markProcessedCall).toBeDefined();
      expect(markProcessedCall[0].where.id).toBe('event-1');
    });

    it('should move exhausted events to dead-letter', async () => {
      const { processor, mockPrisma, mockDeadLetter } = createProcessor();

      mockPrisma.$executeRaw.mockResolvedValue(0);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'event-2' }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'event-2',
                eventType: 'test.event',
                payload: { data: 1 },
                attempts: 6, // > maxRetries (5)
              },
            ]),
          },
        });
      });

      // markProcessed throws → triggers catch path
      mockPrisma.outboxEvent.update.mockRejectedValue(
        new Error('Handler failed'),
      );
      // getAttempts returns 6 (> maxRetries)
      mockPrisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 6 });

      await processor.processOutbox();

      expect(mockDeadLetter.moveToDeadLetter).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'event-2',
          eventType: 'test.event',
        }),
        expect.any(Error),
      );
    });

    it('should requeue events with backoff on transient failure', async () => {
      const { processor, mockPrisma } = createProcessor();

      mockPrisma.$executeRaw.mockResolvedValue(0);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'event-3' }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'event-3',
                eventType: 'test.event',
                payload: { data: 1 },
                attempts: 2, // < maxRetries (5)
              },
            ]),
          },
        });
      });

      // markProcessed throws → requeue
      mockPrisma.outboxEvent.update.mockRejectedValueOnce(
        new Error('Transient failure'),
      );
      // getAttempts returns 2 (< maxRetries)
      mockPrisma.outboxEvent.findUnique.mockResolvedValue({ attempts: 2 });

      await processor.processOutbox();

      const updateCalls = mockPrisma.outboxEvent.update.mock.calls;
      expect(updateCalls.length).toBeGreaterThanOrEqual(1);
      const requeueCall = updateCalls.find(
        (call: any) => call[0].data?.status === 'PENDING',
      );
      expect(requeueCall).toBeDefined();
      expect(requeueCall[0].where.id).toBe('event-3');
      expect(requeueCall[0].data.availableAt).toBeInstanceOf(Date);
      expect(requeueCall[0].data.lockedAt).toBeNull();
    });
  });

  describe('stale lock recovery', () => {
    it('should reset stale PROCESSING rows to PENDING', async () => {
      const { processor, mockPrisma } = createProcessor();

      mockPrisma.$executeRaw.mockResolvedValue(0);

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          $queryRaw: jest.fn().mockResolvedValue([{ id: 'event-4' }]),
          $executeRaw: jest.fn().mockResolvedValue(1),
          outboxEvent: {
            findMany: jest.fn().mockResolvedValue([
              {
                id: 'event-4',
                eventType: 'test.event',
                payload: { data: 1 },
                attempts: 1,
              },
            ]),
          },
        });
      });

      mockPrisma.outboxEvent.update.mockResolvedValue({});

      await processor.processOutbox();

      // $executeRaw should have been called for stale lock recovery
      expect(mockPrisma.$executeRaw).toHaveBeenCalled();
    });
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
