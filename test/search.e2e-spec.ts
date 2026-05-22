import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Search (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;
  let PrismaService: Type<unknown>;
  let SearchEngineService: Type<unknown>;
  let SearchIndexService: Type<unknown>;
  let SearchFallbackService: Type<unknown>;
  let SearchQueryService: Type<unknown>;
  let jwts: JwtService;

  const userId = 'aaaa0000-0000-4000-8000-000000000001';
  const nonAdminUserId = 'bbbb0000-0000-4000-8000-000000000002';

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.BODY_JSON_LIMIT = '1mb';
    process.env.BODY_URLENCODED_LIMIT = '1mb';
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/mdc_test?schema=public';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.HEALTH_DATABASE_TIMEOUT_MS = '1000';
    process.env.HEALTH_REDIS_TIMEOUT_MS = '1000';
    process.env.S3_ENDPOINT = 'http://localhost:9000';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_ACCESS_KEY_ID = 'minioadmin';
    process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
    process.env.S3_BUCKET = 'mdc-test';
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
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-long';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long';
    process.env.COOKIE_SECRET = 'test-cookie-secret-min-32-chars-long';
    process.env.COOKIE_SECURE = 'false';
    process.env.APP_PROCESS_ROLE = 'all';

    const { AppModule } = jest.requireActual<{ AppModule: Type<unknown> }>(
      './../src/app.module',
    );
    const { configureApp } = jest.requireActual<{
      configureApp: (app: INestApplication) => void;
    }>('./../src/bootstrap');
    const { PrismaService: PS } = jest.requireActual<{
      PrismaService: Type<unknown>;
    }>('./../src/infra/prisma');
    PrismaService = PS;
    const { SearchEngineService: SES } = jest.requireActual<{
      SearchEngineService: Type<unknown>;
    }>('./../src/infra/search-engine');
    SearchEngineService = SES;
    const { SearchIndexService: SIS } = jest.requireActual<{
      SearchIndexService: Type<unknown>;
    }>('./../src/search');
    SearchIndexService = SIS;
    const { SearchFallbackService: SFS } = jest.requireActual<{
      SearchFallbackService: Type<unknown>;
    }>('./../src/search');
    SearchFallbackService = SFS;
    const { SearchQueryService: SQS } = jest.requireActual<{
      SearchQueryService: Type<unknown>;
    }>('./../src/search');
    SearchQueryService = SQS;

    const { REDIS_CLIENT } = jest.requireActual<{
      REDIS_CLIENT: symbol;
    }>('./../src/infra/redis/redis.constants');

    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue('OK'),
      keys: jest.fn().mockResolvedValue([]),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      exists: jest.fn().mockResolvedValue(0),
      hget: jest.fn().mockResolvedValue(null),
      hset: jest.fn().mockResolvedValue(1),
      hdel: jest.fn().mockResolvedValue(0),
      hgetall: jest.fn().mockResolvedValue({}),
      hmset: jest.fn().mockResolvedValue('OK'),
      zadd: jest.fn().mockResolvedValue(1),
      zrange: jest.fn().mockResolvedValue([]),
      zrem: jest.fn().mockResolvedValue(0),
      sadd: jest.fn().mockResolvedValue(1),
      srem: jest.fn().mockResolvedValue(0),
      smembers: jest.fn().mockResolvedValue([]),
      publish: jest.fn().mockResolvedValue(0),
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      once: jest.fn(),
      removeAllListeners: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue('OK'),
      ping: jest.fn().mockResolvedValue('PONG'),
      status: 'ready',
    };

    const mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(),
      user: {
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { id: string } }) => {
            if (args?.where?.id === nonAdminUserId) {
              return Promise.resolve({
                id: nonAdminUserId,
                email: 'user@example.com',
                status: 'ACTIVE',
              });
            }
            return Promise.resolve({
              id: userId,
              email: 'admin@example.com',
              status: 'ACTIVE',
            });
          }),
      },
      searchQueryLog: { create: jest.fn().mockResolvedValue({}) },
      searchReindexRun: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: { create: jest.fn() },
      idempotencyKey: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const mockSearchEngine = {
      search: jest.fn().mockResolvedValue({
        hits: {
          total: { value: 2 },
          hits: [
            {
              _id: 'job-1',
              _score: 0.95,
              _source: { title: 'Senior Engineer' },
            },
            {
              _id: 'profile-1',
              _score: 0.85,
              _source: { displayName: 'Jane Dev' },
            },
          ],
        },
      }),
      index: jest.fn().mockResolvedValue(undefined),
      deleteByQuery: jest.fn().mockResolvedValue(undefined),
      checkClusterHealth: jest.fn().mockResolvedValue({ status: 'green' }),
      createIndex: jest.fn().mockResolvedValue(undefined),
      updateAliases: jest.fn().mockResolvedValue(undefined),
      deleteIndex: jest.fn().mockResolvedValue(undefined),
      putMapping: jest.fn().mockResolvedValue(undefined),
      bulkIndex: jest.fn().mockResolvedValue(0),
      getCount: jest.fn().mockResolvedValue(0),
      close: jest.fn().mockResolvedValue(undefined),
    };

    const searchIndexMock = {
      indexDocument: jest.fn().mockResolvedValue(undefined),
      deleteByQuery: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue({}),
      createSearchIndex: jest.fn().mockResolvedValue(undefined),
      reindexEntity: jest.fn().mockResolvedValue('reindex-jobs-123'),
    };

    const searchQueryMock = {
      search: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'job-1',
            type: 'job',
            score: 0.95,
            data: { title: 'Senior Engineer' },
          },
        ],
        meta: {
          total: 1,
          hasNextPage: false,
          took: 10,
          engine: 'elasticsearch',
        },
      }),
      searchEntity: jest.fn().mockResolvedValue({
        data: [],
        meta: {
          total: 0,
          hasNextPage: false,
          took: 10,
          engine: 'elasticsearch',
        },
      }),
    };

    const searchFallbackMock = {
      isCircuitOpen: jest.fn().mockReturnValue(false),
      recordSuccess: jest.fn(),
      recordFailure: jest.fn(),
      checkClusterHealth: jest.fn().mockResolvedValue(undefined),
      getState: jest.fn().mockReturnValue({
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .overrideProvider(SearchEngineService)
      .useValue(mockSearchEngine)
      .overrideProvider(SearchIndexService)
      .useValue(searchIndexMock)
      .overrideProvider(SearchQueryService)
      .useValue(searchQueryMock)
      .overrideProvider(SearchFallbackService)
      .useValue(searchFallbackMock)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    jwts = app.get<JwtService>(JwtService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  function token(userId: string): string {
    return jwts.sign(
      { sub: userId },
      {
        secret: 'test-access-secret-min-32-chars-long',
        expiresIn: '15m',
      },
    );
  }

  // ── Unified search ──────────────────────────────────────────────

  describe('GET /api/v1/search', () => {
    it('should return 200 with data envelope for a valid query', async () => {
      const t = token(userId);
      const response = await request(app!.getHttpServer())
        .get('/api/v1/search')
        .query({ q: 'engineer', limit: 20 })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });

    it('should return 400 when query parameter q is missing', async () => {
      const t = token(userId);
      await request(app!.getHttpServer())
        .get('/api/v1/search')
        .query({ limit: 20 })
        .set('Authorization', `Bearer ${t}`)
        .expect(400);
    });

    it('should filter by entity type', async () => {
      const t = token(userId);
      const response = await request(app!.getHttpServer())
        .get('/api/v1/search')
        .query({ q: 'engineer', type: 'jobs,profiles', limit: 20 })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  // ── Entity-specific search ──────────────────────────────────────

  describe('GET /api/v1/search/jobs', () => {
    it('should return 200 with data array', async () => {
      const t = token(userId);
      const response = await request(app!.getHttpServer())
        .get('/api/v1/search/jobs')
        .query({ q: 'senior engineer', limit: 10 })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/search/users', () => {
    it('should return 200 with data array', async () => {
      const t = token(userId);
      const response = await request(app!.getHttpServer())
        .get('/api/v1/search/users')
        .query({ q: 'react developer', limit: 10 })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/search/companies', () => {
    it('should return 200 with data array', async () => {
      const t = token(userId);
      const response = await request(app!.getHttpServer())
        .get('/api/v1/search/companies')
        .query({ q: 'tech startup', limit: 10 })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('GET /api/v1/search/posts', () => {
    it('should return 200 with data array', async () => {
      const t = token(userId);
      const response = await request(app!.getHttpServer())
        .get('/api/v1/search/posts')
        .query({ q: 'machine learning', limit: 10 })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  // ── Reindex (admin-only) ────────────────────────────────────────

  describe('POST /api/v1/search/reindex', () => {
    it('should return 401 for anonymous users', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/search/reindex')
        .query({ entityType: 'jobs' })
        .expect(401);
    });

    it('should return 403 for non-admin users', async () => {
      const t = token(nonAdminUserId);
      await request(app!.getHttpServer())
        .post('/api/v1/search/reindex')
        .query({ entityType: 'jobs' })
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 400 for invalid entityType', async () => {
      const t = token(userId);
      await request(app!.getHttpServer())
        .post('/api/v1/search/reindex')
        .query({ entityType: 'invalid' })
        .set('Authorization', `Bearer ${t}`)
        .expect(400);
    });
  });
});
