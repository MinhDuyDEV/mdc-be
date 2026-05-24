import { Test } from '@nestjs/testing';
import { PrismaService } from '../infra/prisma';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let service: OutboxService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: PrismaService,
          useValue: {
            outboxEvent: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(OutboxService);
  });

  it('should emit event inside transaction', async () => {
    const mockTx = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };

    await service.emit(mockTx as any, {
      eventType: 'UserRegistered',
      aggregateType: 'User',
      aggregateId: 'user-123',
      payload: {
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
      },
    });

    expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'UserRegistered',
        aggregateType: 'User',
        aggregateId: 'user-123',
        payload: expect.objectContaining({
          userId: 'user-123',
          email: 'test@example.com',
        }),
        status: 'PENDING',
      }),
    });
  });

  it('should emit event with minimal fields', async () => {
    const mockTx = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };

    await service.emit(mockTx as any, {
      eventType: 'UserLoggedIn',
      payload: {
        userId: 'user-123',
        email: 'test@example.com',
        loginAt: new Date().toISOString(),
      },
    });

    expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'UserLoggedIn',
        payload: expect.objectContaining({ userId: 'user-123' }),
        status: 'PENDING',
      }),
    });
  });

  it('should set availableAt when emitting events', async () => {
    const mockTx = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };

    await service.emit(mockTx as any, {
      eventType: 'UserLoggedIn',
      payload: {
        userId: 'user-123',
        email: 'test@example.com',
        loginAt: new Date().toISOString(),
      },
    });

    const [createArgs] = mockTx.outboxEvent.create.mock.calls[0];
    expect(createArgs.data.availableAt).toBeInstanceOf(Date);
  });

  it('should keep aggregate fields optional', async () => {
    const mockTx = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };

    await service.emit(mockTx as any, {
      eventType: 'UserLoggedIn',
      payload: {
        userId: 'user-123',
        email: 'test@example.com',
        loginAt: new Date().toISOString(),
      },
    });

    const [createArgs] = mockTx.outboxEvent.create.mock.calls[0];
    expect(createArgs.data.aggregateType).toBeUndefined();
    expect(createArgs.data.aggregateId).toBeUndefined();
  });

  it('rejects malformed event payloads before insert', async () => {
    const mockTx = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'test-id' }),
      },
    };

    await expect(
      service.emit(mockTx as any, {
        eventType: 'CompanyCreated',
        payload: {},
      }),
    ).rejects.toThrow('Invalid outbox payload for CompanyCreated');
    expect(mockTx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
