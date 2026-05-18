import { DeadLetterService } from './dead-letter.service';
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

describe('DeadLetterService', () => {
  function createService() {
    const mockPrisma = {
      $transaction: jest.fn(),
      outboxDeadLetter: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      outboxEvent: {
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const service = new DeadLetterService(mockPrisma as any);
    return { service, mockPrisma };
  }

  it('should move event to dead letter', async () => {
    const { service, mockPrisma } = createService();

    const event = {
      id: 'event-1',
      eventType: 'test.event',
      payload: { foo: 'bar' },
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      await Promise.resolve();
      return fn({
        outboxDeadLetter: {
          create: jest.fn().mockResolvedValue({ id: 'dl-1' }),
        },
        outboxEvent: {
          update: jest.fn().mockResolvedValue({}),
        },
      });
    });

    await service.moveToDeadLetter(event, new Error('Test error'));

    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should replay dead letter event', async () => {
    const { service, mockPrisma } = createService();

    mockPrisma.outboxDeadLetter.findUnique.mockResolvedValue({
      id: 'dl-1',
      eventType: 'test.event',
      payload: { foo: 'bar' },
    });

    mockPrisma.outboxEvent.create.mockResolvedValue({ id: 'new-event-1' });
    mockPrisma.outboxDeadLetter.delete.mockResolvedValue({});

    await service.replay('dl-1');

    expect(mockPrisma.outboxDeadLetter.findUnique).toHaveBeenCalledWith({
      where: { id: 'dl-1' },
    });
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'test.event',
        status: 'PENDING',
      }),
    });
    expect(mockPrisma.outboxDeadLetter.delete).toHaveBeenCalledWith({
      where: { id: 'dl-1' },
    });
  });

  it('should throw when replaying missing dead letter', async () => {
    const { service, mockPrisma } = createService();

    mockPrisma.outboxDeadLetter.findUnique.mockResolvedValue(null);

    await expect(service.replay('nonexistent')).rejects.toThrow(/not found/);
  });
});
