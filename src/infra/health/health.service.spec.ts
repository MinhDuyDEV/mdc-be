import type { PrismaService } from '../prisma';
import type { RedisHealthService } from '../redis';
import { HealthService } from './health.service';

describe('HealthService', () => {
  function createService(
    options: { postgresFails?: boolean; redisFails?: boolean } = {},
  ) {
    const queryRaw = jest.fn(() => {
      if (options.postgresFails) {
        return Promise.reject(new Error('postgres down'));
      }

      return Promise.resolve([{ '?column?': 1 }]);
    });
    const ping = jest.fn(() => {
      if (options.redisFails) {
        return Promise.reject(new Error('redis down'));
      }

      return Promise.resolve();
    });
    const prisma = {
      $queryRaw: queryRaw,
    } as unknown as PrismaService;

    const redisHealth = {
      ping,
    } as unknown as RedisHealthService;

    return {
      service: new HealthService(prisma, redisHealth),
      queryRaw,
      ping,
    };
  }

  it('returns liveness without external dependency checks', () => {
    const { service, queryRaw, ping } = createService();

    expect(service.live()).toEqual({
      status: 'ok',
      checks: { api: { status: 'up' } },
    });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(ping).not.toHaveBeenCalled();
  });

  it('reports ready when Postgres and Redis are up', async () => {
    const { service } = createService();

    await expect(service.ready()).resolves.toEqual({
      status: 'ok',
      checks: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('fails closed when Postgres is down', async () => {
    const { service } = createService({ postgresFails: true });

    await expect(service.ready()).resolves.toEqual({
      status: 'error',
      checks: {
        postgres: { status: 'down' },
        redis: { status: 'up' },
      },
    });
  });

  it('fails closed when Redis is down', async () => {
    const { service } = createService({ redisFails: true });

    await expect(service.ready()).resolves.toEqual({
      status: 'error',
      checks: {
        postgres: { status: 'up' },
        redis: { status: 'down' },
      },
    });
  });
});
