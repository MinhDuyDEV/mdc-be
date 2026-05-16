import { HealthService } from './health.service';
import { type PrismaService } from '../prisma';
import { type RedisHealthService } from '../redis';

describe('HealthService', () => {
  function createService(options: { postgresFails?: boolean; redisFails?: boolean } = {}) {
    const prisma = {
      $queryRaw: jest.fn(() => {
        if (options.postgresFails) {
          return Promise.reject(new Error('postgres down'));
        }

        return Promise.resolve([{ '?column?': 1 }]);
      }),
    } as unknown as PrismaService;

    const redisHealth = {
      ping: jest.fn(() => {
        if (options.redisFails) {
          return Promise.reject(new Error('redis down'));
        }

        return Promise.resolve();
      }),
    } as unknown as RedisHealthService;

    return { service: new HealthService(prisma, redisHealth), prisma, redisHealth };
  }

  it('returns liveness without external dependency checks', () => {
    const { service, prisma, redisHealth } = createService();

    expect(service.live()).toEqual({ status: 'ok', checks: { api: { status: 'up' } } });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(redisHealth.ping).not.toHaveBeenCalled();
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
