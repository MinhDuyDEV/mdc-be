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
    s3?: DependencyStatus;
    elasticsearch?: DependencyStatus;
    mail?: DependencyStatus;
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
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_ACCESS_KEY_ID = 'minioadmin';
    process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
    process.env.S3_BUCKET = 'mdc-media';
    process.env.S3_FORCE_PATH_STYLE = 'true';
    process.env.HEALTH_S3_TIMEOUT_MS = '1000';
    process.env.ELASTICSEARCH_NODE = 'http://localhost:9200';
    process.env.HEALTH_ELASTICSEARCH_TIMEOUT_MS = '1000';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_USER = 'test';
    process.env.SMTP_PASS = 'test';
    process.env.EMAIL_FROM = 'test@example.com';
    process.env.HEALTH_MAILER_TIMEOUT_MS = '1000';
    process.env.OTEL_SERVICE_NAME = 'mdc-be-test';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32';
    process.env.COOKIE_SECRET = 'test-cookie-secret-min-32';
    process.env.COOKIE_SECURE = 'false';
  };

  async function createApp(healthOverrides?: {
    live?: () => HealthCheckResponse;
    ready?: () => Promise<HealthCheckResponse>;
  }): Promise<INestApplication<App>> {
    const { AppModule } = jest.requireActual<{ AppModule: Type<unknown> }>(
      './../src/app.module',
    );
    const { configureApp } = jest.requireActual<{
      configureApp: (app: INestApplication) => void;
    }>('./../src/bootstrap');
    const { HealthService } = jest.requireActual<{
      HealthService: Type<unknown>;
    }>('./../src/infra/health');
    const { PrismaService } = jest.requireActual<{
      PrismaService: Type<unknown>;
    }>('./../src/infra/prisma');
    const { StorageService } = jest.requireActual<{
      StorageService: Type<unknown>;
    }>('./../src/infra/storage');
    const { StorageHealthService } = jest.requireActual<{
      StorageHealthService: Type<unknown>;
    }>('./../src/infra/storage');
    const { SearchEngineService } = jest.requireActual<{
      SearchEngineService: Type<unknown>;
    }>('./../src/infra/search-engine');
    const { SearchEngineHealthService } = jest.requireActual<{
      SearchEngineHealthService: Type<unknown>;
    }>('./../src/infra/search-engine');
    const { MailerService } = jest.requireActual<{
      MailerService: Type<unknown>;
    }>('./../src/infra/mailer');
    const { MailerHealthService } = jest.requireActual<{
      MailerHealthService: Type<unknown>;
    }>('./../src/infra/mailer');
    const { SearchIndexService } = jest.requireActual<{
      SearchIndexService: Type<unknown>;
    }>('./../src/search');
    const { SearchService } = jest.requireActual<{
      SearchService: Type<unknown>;
    }>('./../src/search');
    const { OutboxProcessor } = jest.requireActual<{
      OutboxProcessor: Type<unknown>;
    }>('./../src/outbox');
    const { DeadLetterService } = jest.requireActual<{
      DeadLetterService: Type<unknown>;
    }>('./../src/outbox');
    const { IdempotencyService } = jest.requireActual<{
      IdempotencyService: Type<unknown>;
    }>('./../src/outbox');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue({
        live: () => ({
          status: 'ok' as const,
          checks: { api: { status: 'up' as const } },
          ...healthOverrides?.live?.(),
        }),
        ready: async () => ({
          status: 'ok' as const,
          checks: {
            postgres: { status: 'up' as const },
            redis: { status: 'up' as const },
            s3: { status: 'up' as const },
            elasticsearch: { status: 'up' as const },
            mail: { status: 'up' as const },
          },
          ...(healthOverrides?.ready ? await healthOverrides.ready() : {}),
        }),
      })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      })
      .overrideProvider(StorageService)
      .useValue({
        generatePresignedUploadUrl: jest.fn(),
        generatePresignedDownloadUrl: jest.fn(),
        headBucket: jest.fn(),
      })
      .overrideProvider(StorageHealthService)
      .useValue({
        ping: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(SearchEngineService)
      .useValue({
        checkClusterHealth: jest.fn(),
        index: jest.fn(),
        search: jest.fn(),
        deleteByQuery: jest.fn(),
      })
      .overrideProvider(SearchEngineHealthService)
      .useValue({
        ping: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(MailerService)
      .useValue({
        sendMail: jest.fn().mockResolvedValue(undefined),
        verifyConnection: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(MailerHealthService)
      .useValue({
        ping: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(SearchService)
      .useValue({
        toTsQuery: jest.fn().mockReturnValue(''),
        tsVectorExpression: jest.fn().mockReturnValue(''),
        tsQueryExpression: jest.fn().mockReturnValue(''),
      })
      .overrideProvider(SearchIndexService)
      .useValue({
        indexDocument: jest.fn(),
        deleteByQuery: jest.fn(),
        search: jest.fn(),
      })
      .overrideProvider(OutboxProcessor)
      .useValue({
        processOutbox: jest.fn(),
        claimEvents: jest.fn().mockResolvedValue([]),
      })
      .overrideProvider(DeadLetterService)
      .useValue({
        moveToDeadLetter: jest.fn(),
        replay: jest.fn(),
      })
      .overrideProvider(IdempotencyService)
      .useValue({
        claim: jest.fn().mockResolvedValue({ id: 'key-1' }),
        cleanup: jest.fn(),
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
          ready: () =>
            Promise.resolve({
              status: 'error',
              checks: {
                postgres: { status: 'down' },
                redis: { status: 'up' },
                s3: { status: 'up' },
                elasticsearch: { status: 'up' },
                mail: { status: 'up' },
              },
            }),
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
          ready: () =>
            Promise.resolve({
              status: 'error',
              checks: {
                postgres: { status: 'up' },
                redis: { status: 'down' },
                s3: { status: 'up' },
                elasticsearch: { status: 'up' },
                mail: { status: 'up' },
              },
            }),
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
          ready: () =>
            Promise.resolve({
              status: 'error',
              checks: {
                postgres: { status: 'down' },
                redis: { status: 'down' },
                s3: { status: 'up' },
                elasticsearch: { status: 'up' },
                mail: { status: 'up' },
              },
            }),
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
