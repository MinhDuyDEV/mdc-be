import type { INestApplication, Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

interface DependencyStatus {
  status: 'up' | 'down';
}

interface HealthCheckResponse {
  status: 'ok' | 'error';
  checks: {
    api?: DependencyStatus;
    postgres?: DependencyStatus;
    redis?: DependencyStatus;
  };
}

describe('HealthController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;

  const baseEnv = () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.BODY_JSON_LIMIT = '1mb';
    process.env.BODY_URLENCODED_LIMIT = '1mb';
    process.env.DATABASE_URL =
      'postgresql://mdc:mdc_dev_password@localhost:5432/mdc?schema=public';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.HEALTH_DATABASE_TIMEOUT_MS = '1000';
    process.env.HEALTH_REDIS_TIMEOUT_MS = '1000';
  };

  async function createApp(overrides?: {
    prisma?: Record<string, unknown>;
    redisHealth?: Record<string, unknown>;
  }): Promise<INestApplication<App>> {
    const { AppModule } = jest.requireActual<{ AppModule: Type<unknown> }>(
      './../src/app.module',
    );
    const { configureApp } = jest.requireActual<{
      configureApp: (app: INestApplication) => void;
    }>('./../src/bootstrap');
    const { PrismaService } = jest.requireActual<{
      PrismaService: Type<unknown>;
    }>('./../src/infra/prisma');
    const { RedisHealthService } = jest.requireActual<{
      RedisHealthService: Type<unknown>;
    }>('./../src/infra/redis');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        ...overrides?.prisma,
      })
      .overrideProvider(RedisHealthService)
      .useValue({
        ping: jest.fn().mockResolvedValue(undefined),
        ...overrides?.redisHealth,
      })
      .compile();

    const nestApp = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(nestApp);
    await nestApp.init();
    return nestApp;
  }

  beforeEach(() => {
    originalEnv = { ...process.env };
    baseEnv();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    process.env = originalEnv;
  });

  describe('GET /health/live', () => {
    beforeEach(async () => {
      app = await createApp();
    });

    it('returns 200 with ok status (no dependency checks)', async () => {
      const response = await request(app!.getHttpServer())
        .get('/health/live')
        .expect(200);

      const body = response.body as HealthCheckResponse;
      expect(body).toEqual({
        status: 'ok',
        checks: { api: { status: 'up' } },
      });
    });
  });

  describe('GET /health/ready', () => {
    describe('when all dependencies are healthy', () => {
      beforeEach(async () => {
        app = await createApp();
      });

      it('returns 200 with dependency statuses', async () => {
        const response = await request(app!.getHttpServer())
          .get('/health/ready')
          .expect(200);

        const body = response.body as HealthCheckResponse;
        expect(body.status).toBe('ok');
        expect(body.checks.postgres).toEqual({ status: 'up' });
        expect(body.checks.redis).toEqual({ status: 'up' });
      });
    });

    describe('when Postgres is down', () => {
      beforeEach(async () => {
        app = await createApp({
          prisma: {
            $queryRaw: jest
              .fn()
              .mockRejectedValue(new Error('connection refused')),
          },
        });
      });

      it('returns 503 with postgres down', async () => {
        const response = await request(app!.getHttpServer())
          .get('/health/ready')
          .expect(503);

        const body = response.body as HealthCheckResponse;
        expect(body.status).toBe('error');
        expect(body.checks.postgres).toEqual({ status: 'down' });
        expect(body.checks.redis).toEqual({ status: 'up' });
      });
    });

    describe('when Redis is down', () => {
      beforeEach(async () => {
        app = await createApp({
          redisHealth: {
            ping: jest.fn().mockRejectedValue(new Error('connection refused')),
          },
        });
      });

      it('returns 503 with redis down', async () => {
        const response = await request(app!.getHttpServer())
          .get('/health/ready')
          .expect(503);

        const body = response.body as HealthCheckResponse;
        expect(body.status).toBe('error');
        expect(body.checks.postgres).toEqual({ status: 'up' });
        expect(body.checks.redis).toEqual({ status: 'down' });
      });
    });

    describe('when both Postgres and Redis are down', () => {
      beforeEach(async () => {
        app = await createApp({
          prisma: {
            $queryRaw: jest
              .fn()
              .mockRejectedValue(new Error('connection refused')),
          },
          redisHealth: {
            ping: jest.fn().mockRejectedValue(new Error('connection refused')),
          },
        });
      });

      it('returns 503 with both dependencies down', async () => {
        const response = await request(app!.getHttpServer())
          .get('/health/ready')
          .expect(503);

        const body = response.body as HealthCheckResponse;
        expect(body.status).toBe('error');
        expect(body.checks.postgres).toEqual({ status: 'down' });
        expect(body.checks.redis).toEqual({ status: 'down' });
      });
    });
  });
});
