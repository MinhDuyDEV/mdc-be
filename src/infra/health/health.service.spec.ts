import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config';
import type { MailerHealthService } from '../mailer';
import type { PrismaService } from '../prisma';
import type { RedisHealthService } from '../redis';
import type { SearchEngineHealthService } from '../search-engine';
import type { StorageHealthService } from '../storage';
import { HealthService } from './health.service';

describe('HealthService', () => {
  function createService(
    options: {
      postgresFails?: boolean;
      postgresHangs?: boolean;
      redisFails?: boolean;
      s3Fails?: boolean;
      esFails?: boolean;
      mailFails?: boolean;
    } = {},
  ) {
    const queryRaw = jest.fn(() => {
      if (options.postgresFails) {
        return Promise.reject(new Error('postgres down'));
      }

      if (options.postgresHangs) {
        return new Promise(() => undefined);
      }

      return Promise.resolve([{ '?column?': 1 }]);
    });
    const redisPing = jest.fn(() => {
      if (options.redisFails) {
        return Promise.reject(new Error('redis down'));
      }

      return Promise.resolve();
    });
    const s3Ping = jest.fn(() => {
      if (options.s3Fails) {
        return Promise.reject(new Error('s3 down'));
      }

      return Promise.resolve();
    });
    const esPing = jest.fn(() => {
      if (options.esFails) {
        return Promise.reject(new Error('es down'));
      }

      return Promise.resolve();
    });
    const mailPing = jest.fn(() => {
      if (options.mailFails) {
        return Promise.reject(new Error('mail down'));
      }

      return Promise.resolve();
    });

    const prisma = {
      $queryRaw: queryRaw,
    } as unknown as PrismaService;

    const redisHealth = {
      ping: redisPing,
    } as unknown as RedisHealthService;

    const storageHealth = {
      ping: s3Ping,
    } as unknown as StorageHealthService;

    const searchEngineHealth = {
      ping: esPing,
    } as unknown as SearchEngineHealthService;

    const mailerHealth = {
      ping: mailPing,
    } as unknown as MailerHealthService;

    const configService = {
      get: jest.fn(() => 1),
    } as unknown as ConfigService<AppConfig, true>;

    return {
      service: new HealthService(
        prisma,
        redisHealth,
        storageHealth,
        searchEngineHealth,
        mailerHealth,
        configService,
      ),
      queryRaw,
      redisPing,
      s3Ping,
      esPing,
      mailPing,
    };
  }

  it('returns liveness without external dependency checks', () => {
    const { service, queryRaw, redisPing, s3Ping, esPing, mailPing } =
      createService();

    expect(service.live()).toEqual({
      status: 'ok',
      checks: { api: { status: 'up' } },
    });
    expect(queryRaw).not.toHaveBeenCalled();
    expect(redisPing).not.toHaveBeenCalled();
    expect(s3Ping).not.toHaveBeenCalled();
    expect(esPing).not.toHaveBeenCalled();
    expect(mailPing).not.toHaveBeenCalled();
  });

  it('reports ready when all dependencies are up', async () => {
    const { service } = createService();

    await expect(service.ready()).resolves.toEqual({
      status: 'ok',
      checks: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        s3: { status: 'up' },
        elasticsearch: { status: 'up' },
        mail: { status: 'up' },
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
        s3: { status: 'up' },
        elasticsearch: { status: 'up' },
        mail: { status: 'up' },
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
        s3: { status: 'up' },
        elasticsearch: { status: 'up' },
        mail: { status: 'up' },
      },
    });
  });

  it('fails closed when S3 is down', async () => {
    const { service } = createService({ s3Fails: true });

    await expect(service.ready()).resolves.toEqual({
      status: 'error',
      checks: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        s3: { status: 'down' },
        elasticsearch: { status: 'up' },
        mail: { status: 'up' },
      },
    });
  });

  it('fails closed when Elasticsearch is down', async () => {
    const { service } = createService({ esFails: true });

    await expect(service.ready()).resolves.toEqual({
      status: 'error',
      checks: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        s3: { status: 'up' },
        elasticsearch: { status: 'down' },
        mail: { status: 'up' },
      },
    });
  });

  it('fails closed when mail adapter is down', async () => {
    const { service } = createService({ mailFails: true });

    await expect(service.ready()).resolves.toEqual({
      status: 'error',
      checks: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
        s3: { status: 'up' },
        elasticsearch: { status: 'up' },
        mail: { status: 'down' },
      },
    });
  });

  it('fails closed when Postgres readiness hangs past the configured timeout', async () => {
    const { service } = createService({ postgresHangs: true });

    await expect(service.ready()).resolves.toEqual({
      status: 'error',
      checks: {
        postgres: { status: 'down' },
        redis: { status: 'up' },
        s3: { status: 'up' },
        elasticsearch: { status: 'up' },
        mail: { status: 'up' },
      },
    });
  });
});
