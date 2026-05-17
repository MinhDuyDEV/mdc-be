import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  it('connects and disconnects during Nest lifecycle hooks', async () => {
    const connect = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const disconnect = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('withTransaction delegates to $transaction', async () => {
    const txResult = { created: true };
    const transactionSpy = jest
      .spyOn(service, '$transaction')
      .mockResolvedValue(txResult);

    const result = await service.withTransaction((tx) => {
      // tx should be a PrismaTransaction (same shape as PrismaService)
      expect(tx).toBeDefined();
      return Promise.resolve(txResult);
    });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(txResult);
  });

  it('withTransaction propagates errors from $transaction', async () => {
    const error = new Error('transaction failed');
    jest.spyOn(service, '$transaction').mockRejectedValue(error);

    await expect(
      service.withTransaction(() => Promise.resolve({})),
    ).rejects.toThrow('transaction failed');
  });
});
