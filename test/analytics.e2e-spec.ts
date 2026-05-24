import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createAdminPermissions,
  createOutboxEventMock,
  createRedisMock,
} from './helpers/e2e-mocks';

jest.setTimeout(30_000);

describe('Analytics (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;
  let jwts: JwtService;

  const adminUserId = 'aaaa0000-0000-4000-8000-000000000001';
  const regularUserId = 'bbbb0000-0000-4000-8000-000000000002';

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3004';
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
    process.env.COOKIE_SECRET = 'test-cookie-secret-min-32-chars-long';
    process.env.COOKIE_SECURE = 'false';
    process.env.APP_PROCESS_ROLE = 'all';

    const { AppModule } = jest.requireActual<{ AppModule: Type<unknown> }>(
      './../src/app.module',
    );
    const { PrismaService } = jest.requireActual<{
      PrismaService: Type<unknown>;
    }>('./../src/infra/prisma');
    const { configureApp } = jest.requireActual<{
      configureApp: (app: INestApplication) => void;
    }>('./../src/bootstrap');
    const { REDIS_CLIENT } = jest.requireActual<{
      REDIS_CLIENT: symbol;
    }>('./../src/infra/redis/redis.constants');

    const mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ total: BigInt(0) }]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: any) => cb(mockPrisma)),
      user: {
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { id: string } }) => {
            const id = args?.where?.id;
            if (id === adminUserId) {
              return Promise.resolve({
                id,
                email: 'admin@test.com',
                status: 'ACTIVE',
              });
            }
            return Promise.resolve({
              id: regularUserId,
              email: 'user@test.com',
              status: 'ACTIVE',
            });
          }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(5),
        update: jest.fn(),
      },
      adminUser: {
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { userId: string } }) => {
            if (args?.where?.userId === adminUserId) {
              return Promise.resolve({
                role: 'ADMIN',
                permissions: createAdminPermissions('VIEW_ANALYTICS'),
              });
            }
            return Promise.resolve(null);
          }),
      },
      adminPermission: { findMany: jest.fn().mockResolvedValue([]) },
      profileView: { create: jest.fn().mockResolvedValue({ id: 'pv-1' }) },
      companyView: { create: jest.fn().mockResolvedValue({ id: 'cv-1' }) },
      postImpression: { create: jest.fn().mockResolvedValue({ id: 'pi-1' }) },
      slottedCounter: { upsert: jest.fn().mockResolvedValue({}) },
      post: { count: jest.fn().mockResolvedValue(3) },
      job: { count: jest.fn().mockResolvedValue(2) },
      application: { count: jest.fn().mockResolvedValue(1) },
      report: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      outboxEvent: createOutboxEventMock(),
      idempotencyKey: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      searchQueryLog: { create: jest.fn().mockResolvedValue({}) },
      searchReindexRun: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      emailDelivery: { create: jest.fn().mockResolvedValue({}) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    const mockRedis = createRedisMock();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
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
      { secret: 'test-access-secret-min-32-chars-long', expiresIn: '15m' },
    );
  }

  // ── POST /api/v1/analytics/events (public / any user) ────────────

  describe('POST /api/v1/analytics/events', () => {
    it('should return 200 for anonymous user recording an event', async () => {
      const res = await request(app!.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventType: 'profile_view',
          targetId: '00000000-0000-4000-8000-000000000001',
          source: 'search',
        })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });

    it('should return 200 for authenticated user', async () => {
      const t = token(regularUserId);
      const res = await request(app!.getHttpServer())
        .post('/api/v1/analytics/events')
        .set('Authorization', `Bearer ${t}`)
        .send({
          eventType: 'company_view',
          targetId: '00000000-0000-4000-8000-000000000002',
        })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });

    it('should return 400 for invalid eventType', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventType: 'invalid_type',
          targetId: '00000000-0000-4000-8000-000000000001',
        })
        .expect(400);
    });

    it('should return 400 for missing targetId', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({ eventType: 'profile_view' })
        .expect(400);
    });

    it('should accept post_impression events', async () => {
      const res = await request(app!.getHttpServer())
        .post('/api/v1/analytics/events')
        .send({
          eventType: 'post_impression',
          targetId: '00000000-0000-4000-8000-000000000003',
        })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });
  });

  // ── GET /api/v1/analytics/dashboard (admin only) ─────────────────

  describe('GET /api/v1/analytics/dashboard', () => {
    it('should return 401 for anonymous users', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .expect(401);
    });

    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 200 with dashboard metrics for admin', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('dailyNewUsers');
      expect(res.body.data).toHaveProperty('dailyNewPosts');
      expect(res.body.data).toHaveProperty('dailyNewJobs');
      expect(res.body.data).toHaveProperty('dailyApplications');
      expect(res.body.data).toHaveProperty('dailyReports');
    });
  });

  // ── GET /api/v1/analytics/entity/:type/:id (admin only) ──────────

  describe('GET /api/v1/analytics/entity/:type/:id', () => {
    it('should return 401 for anonymous users', async () => {
      await request(app!.getHttpServer())
        .get(
          '/api/v1/analytics/entity/profile_view/00000000-0000-4000-8000-000000000001',
        )
        .expect(401);
    });

    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .get(
          '/api/v1/analytics/entity/profile_view/00000000-0000-4000-8000-000000000001',
        )
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 200 with entity analytics for admin', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get(
          '/api/v1/analytics/entity/profile_view/00000000-0000-4000-8000-000000000001',
        )
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('totalViews');
      expect(res.body.data).toHaveProperty('uniqueViewers');
    });
  });
});
