import { DeadLetterService } from './dead-letter.service';

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

  it('should replay dead letter event within a transaction', async () => {
    const { service, mockPrisma } = createService();

    // replay() wraps in $transaction, so mock it as a passthrough
    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockPrisma));
    mockPrisma.outboxDeadLetter.findUnique.mockResolvedValue({
      id: 'dl-1',
      eventType: 'UserRegistered',
      payload: {
        userId: 'user-1',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      },
    });
    mockPrisma.outboxEvent.create.mockResolvedValue({ id: 'new-event-1' });
    mockPrisma.outboxDeadLetter.delete.mockResolvedValue({});

    await service.replay('dl-1');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.outboxDeadLetter.findUnique).toHaveBeenCalledWith({
      where: { id: 'dl-1' },
    });
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'UserRegistered',
        status: 'PENDING',
      }),
    });
    expect(mockPrisma.outboxDeadLetter.delete).toHaveBeenCalledWith({
      where: { id: 'dl-1' },
    });
  });

  it('should throw when replaying missing dead letter', async () => {
    const { service, mockPrisma } = createService();

    mockPrisma.$transaction.mockImplementation((fn: any) => fn(mockPrisma));
    mockPrisma.outboxDeadLetter.findUnique.mockResolvedValue(null);

    await expect(service.replay('nonexistent')).rejects.toThrow(/not found/);
  });

  it('should replay using provided transaction client', async () => {
    const { service, mockPrisma } = createService();
    const tx = {
      outboxDeadLetter: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'dl-1',
          eventType: 'UserLoggedIn',
          payload: {
            userId: 'user-1',
            email: 'test@example.com',
            loginAt: new Date().toISOString(),
          },
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'new-event-1' }),
      },
    };

    await service.replay(tx as any, 'dl-1');

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'UserLoggedIn',
        status: 'PENDING',
      }),
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});
