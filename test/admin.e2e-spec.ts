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

describe('Admin (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;
  let jwts: JwtService;

  const adminUserId = 'aaaa0000-0000-4000-8000-000000000001';
  const regularUserId = 'bbbb0000-0000-4000-8000-000000000002';
  const managedUserId = 'cccc0000-0000-4000-8000-000000000003';
  const companyId = 'dddd0000-0000-4000-8000-000000000004';

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3003';
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
      $queryRaw: jest.fn().mockResolvedValue([{ id: managedUserId }]),
      $executeRaw: jest.fn().mockResolvedValue(0),
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
              id,
              email: 'user@test.com',
              status: 'ACTIVE',
            });
          }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: managedUserId,
            email: 'user1@test.com',
            displayName: 'User One',
            status: 'ACTIVE',
          },
          {
            id: 'eeee0000-0000-4000-8000-000000000005',
            email: 'user2@test.com',
            displayName: 'User Two',
            status: 'ACTIVE',
          },
        ]),
        update: jest
          .fn()
          .mockResolvedValue({ id: managedUserId, status: 'SUSPENDED' }),
        count: jest.fn().mockResolvedValue(0),
      },
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: companyId, name: 'Test Corp' }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: companyId, name: 'Test Corp', verified: false },
          ]),
        update: jest.fn().mockResolvedValue({}),
      },
      companyVerification: {
        upsert: jest.fn().mockResolvedValue({ status: 'VERIFIED' }),
        update: jest.fn().mockResolvedValue({ status: 'VERIFIED' }),
      },
      job: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'job-1', title: 'Test Job' }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'job-1', title: 'Software Engineer', status: 'PUBLISHED' },
          ]),
        update: jest.fn().mockResolvedValue({}),
      },
      adminUser: {
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { userId: string } }) => {
            if (args?.where?.userId === adminUserId) {
              return Promise.resolve({
                role: 'ADMIN',
                permissions: createAdminPermissions(
                  'MANAGE_USERS',
                  'MANAGE_COMPANIES',
                  'MANAGE_JOBS',
                ),
              });
            }
            return Promise.resolve(null);
          }),
      },
      adminPermission: { findMany: jest.fn().mockResolvedValue([]) },
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
      post: {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      comment: { findUnique: jest.fn().mockResolvedValue(null) },
      message: { findUnique: jest.fn().mockResolvedValue(null) },
      profile: { findUnique: jest.fn().mockResolvedValue(null) },
      report: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
      moderationAction: { create: jest.fn().mockResolvedValue({}) },
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

  // ── GET /api/v1/admin/users (admin only) ─────────────────────────

  describe('GET /api/v1/admin/users', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 401 for anonymous users', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/admin/users')
        .expect(401);
    });

    it('should return 200 with paginated results for admin', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter by status', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/admin/users')
        .query({ status: 'ACTIVE' })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });
  });

  // ── PATCH /api/v1/admin/users/:id/status ─────────────────────────

  describe('PATCH /api/v1/admin/users/:id/status', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .patch(`/api/v1/admin/users/${managedUserId}/status`)
        .set('Authorization', `Bearer ${t}`)
        .send({ status: 'SUSPENDED', reason: 'Spam' })
        .expect(403);
    });

    it('should return 200 for admin suspending a user', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .patch(`/api/v1/admin/users/${managedUserId}/status`)
        .set('Authorization', `Bearer ${t}`)
        .send({ status: 'SUSPENDED', reason: 'Repeated spam' })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });

    it('should return 400 for invalid status', async () => {
      const t = token(adminUserId);
      await request(app!.getHttpServer())
        .patch(`/api/v1/admin/users/${managedUserId}/status`)
        .set('Authorization', `Bearer ${t}`)
        .send({ status: 'INVALID', reason: 'Test' })
        .expect(400);
    });
  });

  // ── GET /api/v1/admin/companies ──────────────────────────────────

  describe('GET /api/v1/admin/companies', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .get('/api/v1/admin/companies')
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 200 with company list for admin', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/admin/companies')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });
  });

  // ── PATCH /api/v1/admin/companies/:id/verification ───────────────

  describe('PATCH /api/v1/admin/companies/:id/verification', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .patch(`/api/v1/admin/companies/${companyId}/verification`)
        .set('Authorization', `Bearer ${t}`)
        .send({ notes: 'Verified' })
        .expect(403);
    });

    it('should return 200 for admin verifying a company', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .patch(`/api/v1/admin/companies/${companyId}/verification`)
        .set('Authorization', `Bearer ${t}`)
        .send({ notes: 'Documents verified' })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });
  });

  // ── GET /api/v1/admin/jobs ───────────────────────────────────────

  describe('GET /api/v1/admin/jobs', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 200 with job list for admin', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });
  });
});
