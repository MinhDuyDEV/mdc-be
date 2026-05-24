import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
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
      // tx should be a PrismaTransaction.
      expect(tx).toBeDefined();
      return Promise.resolve(txResult);
    });

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(transactionSpy).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5000,
      timeout: 15000,
    });
    expect(result).toBe(txResult);
  });

  it('withTransaction uses configured transaction timeout defaults', async () => {
    const configService = {
      get: jest.fn((key: keyof AppConfig) => {
        if (key === 'prismaTransactionMaxWaitMs') return 7000;
        if (key === 'prismaTransactionTimeoutMs') return 20000;
        return undefined;
      }),
    } as unknown as ConfigService<AppConfig, true>;
    service = new PrismaService(configService);
    const txResult = { created: true };
    const transactionSpy = jest
      .spyOn(service, '$transaction')
      .mockResolvedValue(txResult);

    await service.withTransaction(() => Promise.resolve(txResult));

    expect(transactionSpy).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 7000,
      timeout: 20000,
    });
  });

  it('withTransaction propagates errors from $transaction', async () => {
    const error = new Error('transaction failed');
    jest.spyOn(service, '$transaction').mockRejectedValue(error);

    await expect(
      service.withTransaction(() => Promise.resolve({})),
    ).rejects.toThrow('transaction failed');
  });
});
