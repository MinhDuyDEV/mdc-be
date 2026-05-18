import { IdempotencyService } from './idempotency.service';
/* eslint-disable @typescript-eslint/no-unsafe-argument */

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

    const service = new IdempotencyService(mockPrisma as any);
    return { service, mockPrisma };
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
    const { service, mockPrisma } = createService();

    mockPrisma.idempotencyKey.deleteMany.mockResolvedValue({ count: 42 });

    await service.cleanup();

    expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});
