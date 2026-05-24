import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  function createService() {
    const mockPrisma = {
      idempotencyKey: {
        create: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };
    const mockLeaderLock = {
      runIfLeader: jest.fn(
        async (
          _lockName: string,
          _ttlMs: number,
          work: () => Promise<void>,
        ) => {
          await work();
          return true;
        },
      ),
    };

    const service = new IdempotencyService(
      mockPrisma as any,
      mockLeaderLock as any,
    );
    return { service, mockPrisma, mockLeaderLock };
  }

  it('should claim new idempotency key', async () => {
    const { service, mockPrisma } = createService();

    mockPrisma.idempotencyKey.create.mockResolvedValue({ id: 'key-1' });

    const result = await service.claim('test-scope', 'key-123');

    expect(result).toEqual({ id: 'key-1' });
    expect(mockPrisma.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'test-scope',
        key: 'key-123',
      }),
    });
  });

  it('should return existing key on conflict', async () => {
    const { service, mockPrisma } = createService();

    mockPrisma.idempotencyKey.create.mockRejectedValue({ code: 'P2002' });
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'existing-key' }]);

    const result = await service.claim('test-scope', 'key-123');

    expect(result).toEqual({ id: 'existing-key' });
  });

  it('should use provided transaction client when claiming', async () => {
    const { service, mockPrisma } = createService();
    const tx = {
      idempotencyKey: {
        create: jest.fn().mockResolvedValue({ id: 'tx-key' }),
      },
      $queryRaw: jest.fn(),
    };

    const result = await service.claim(tx as any, 'test-scope', 'key-123');

    expect(result).toEqual({ id: 'tx-key' });
    expect(tx.idempotencyKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        scope: 'test-scope',
        key: 'key-123',
      }),
    });
    expect(mockPrisma.idempotencyKey.create).not.toHaveBeenCalled();
  });

  it('should use provided transaction client when locking existing keys', async () => {
    const { service, mockPrisma } = createService();
    const tx = {
      idempotencyKey: {
        create: jest.fn().mockRejectedValue({ code: 'P2002' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'existing-tx-key' }]),
    };

    const result = await service.claim(tx as any, 'test-scope', 'key-123');

    expect(result).toEqual({ id: 'existing-tx-key' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('should re-throw non-P2002 errors', async () => {
    const { service, mockPrisma } = createService();

    mockPrisma.idempotencyKey.create.mockRejectedValue(
      new Error('Connection lost'),
    );

    await expect(service.claim('test-scope', 'key-123')).rejects.toThrow(
      'Connection lost',
    );
  });

  it('should delete expired keys during cleanup', async () => {
    const { service, mockPrisma, mockLeaderLock } = createService();

    mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 42 });

    await service.cleanup();

    expect(mockLeaderLock.runIfLeader).toHaveBeenCalledWith(
      'idempotency-cleanup',
      50000,
      expect.any(Function),
    );
    expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('should skip cleanup when another worker holds the leader lock', async () => {
    const { service, mockPrisma, mockLeaderLock } = createService();
    mockLeaderLock.runIfLeader.mockResolvedValue(false);

    await service.cleanup();

    expect(mockPrisma.idempotencyKey.deleteMany).not.toHaveBeenCalled();
  });
});
