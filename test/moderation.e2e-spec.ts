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

describe('Moderation (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;
  let jwts: JwtService;

  const adminUserId = 'aaaa0000-0000-4000-8000-000000000001';
  const moderatorUserId = 'aaaa0000-0000-4000-8000-000000000002';
  const regularUserId = 'bbbb0000-0000-4000-8000-000000000003';
  const reportId = 'cccc0000-0000-4000-8000-000000000004';
  const postId = 'dddd0000-0000-4000-8000-000000000005';
  const commentId = 'eeee0000-0000-4000-8000-000000000006';
  const messageId = 'ffff0000-0000-4000-8000-000000000007';
  const profileId = '11110000-0000-4000-8000-000000000008';
  const companyId = '22220000-0000-4000-8000-000000000009';
  const jobId = '33330000-0000-4000-8000-000000000010';

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3002';
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

    const mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ id: reportId }]),
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest
        .fn()
        .mockImplementation(async (cb: any) => cb(mockPrisma)),
      user: {
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { id: string } }) => {
            const id = args?.where?.id;
            if (id === adminUserId || id === moderatorUserId) {
              return Promise.resolve({
                id,
                email: `${id}@test.com`,
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
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      adminUser: {
        findUnique: jest
          .fn()
          .mockImplementation((args: { where: { userId: string } }) => {
            const userId = args?.where?.userId;
            if (userId === adminUserId) {
              return Promise.resolve({
                role: 'SUPER_ADMIN',
                permissions: [],
              });
            }
            if (userId === moderatorUserId) {
              return Promise.resolve({
                role: 'MODERATOR',
                permissions: createAdminPermissions('MODERATE_CONTENT'),
              });
            }
            return Promise.resolve(null);
          }),
      },
      adminPermission: { findMany: jest.fn().mockResolvedValue([]) },
      report: {
        create: jest.fn().mockResolvedValue({
          id: reportId,
          reporterId: regularUserId,
          targetEntity: 'POST',
          targetId: postId,
          category: 'SPAM',
          description: 'Test report',
          status: 'PENDING',
          priority: 2,
          assignedToId: null,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: reportId,
          reporterId: regularUserId,
          targetEntity: 'POST',
          targetId: postId,
          category: 'SPAM',
          description: 'Test report',
          status: 'UNDER_REVIEW',
          priority: 2,
          assignedToId: moderatorUserId,
          resolvedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      moderationAction: { create: jest.fn().mockResolvedValue({}) },
      post: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: postId, content: 'test' }),
        update: jest.fn().mockResolvedValue({}),
      },
      comment: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: commentId, content: 'test' }),
      },
      message: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: messageId, content: 'test' }),
      },
      profile: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: profileId, headline: 'test' }),
      },
      company: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: companyId, name: 'Test Corp' }),
      },
      job: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: jobId, title: 'Test Job' }),
      },
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

    const { REDIS_CLIENT } = jest.requireActual<{
      REDIS_CLIENT: symbol;
    }>('./../src/infra/redis/redis.constants');

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

  // ── POST /api/v1/moderation/reports (create report) ──────────────

  describe('POST /api/v1/moderation/reports', () => {
    it('should return 201 for authenticated user', async () => {
      const t = token(regularUserId);
      const res = await request(app!.getHttpServer())
        .post('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${t}`)
        .send({
          targetEntity: 'POST',
          targetId: postId,
          category: 'SPAM',
          description: 'This is spam',
        })
        .expect(201);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('PENDING');
    });

    it('should return 401 for anonymous users', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/moderation/reports')
        .send({ targetEntity: 'POST', targetId: postId, category: 'SPAM' })
        .expect(401);
    });

    it('should return 400 for invalid category', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .post('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${t}`)
        .send({ targetEntity: 'POST', targetId: postId, category: 'INVALID' })
        .expect(400);
    });

    it('should return 400 for missing targetId', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .post('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${t}`)
        .send({ targetEntity: 'POST', category: 'SPAM' })
        .expect(400);
    });
  });

  // ── GET /api/v1/moderation/reports (list reports — admin/moderator only) ──

  describe('GET /api/v1/moderation/reports', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .get('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 401 for anonymous users', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/moderation/reports')
        .expect(401);
    });

    it('should return 200 for admin users', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return 200 for moderator users', async () => {
      const t = token(moderatorUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/moderation/reports')
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });

    it('should filter by status', async () => {
      const t = token(adminUserId);
      const res = await request(app!.getHttpServer())
        .get('/api/v1/moderation/reports')
        .query({ status: 'PENDING' })
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });
  });

  // ── PATCH /api/v1/moderation/reports/:id/claim ───────────────────

  describe('PATCH /api/v1/moderation/reports/:id/claim', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .patch(`/api/v1/moderation/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${t}`)
        .expect(403);
    });

    it('should return 200 for moderator claiming a report', async () => {
      const t = token(moderatorUserId);
      const res = await request(app!.getHttpServer())
        .patch(`/api/v1/moderation/reports/${reportId}/claim`)
        .set('Authorization', `Bearer ${t}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });
  });

  // ── POST /api/v1/moderation/actions ──────────────────────────────

  describe('POST /api/v1/moderation/actions', () => {
    it('should return 403 for regular users', async () => {
      const t = token(regularUserId);
      await request(app!.getHttpServer())
        .post('/api/v1/moderation/actions')
        .set('Authorization', `Bearer ${t}`)
        .send({
          reportId,
          actionType: 'WARN',
          targetEntity: 'POST',
          targetId: postId,
          reason: 'Test action',
        })
        .expect(403);
    });

    it('should return 200 for moderator applying an action', async () => {
      const t = token(moderatorUserId);
      const res = await request(app!.getHttpServer())
        .post('/api/v1/moderation/actions')
        .set('Authorization', `Bearer ${t}`)
        .send({
          reportId,
          actionType: 'WARN',
          targetEntity: 'POST',
          targetId: postId,
          reason: 'Test warning',
        })
        .expect(200);

      expect(res.body.data.success).toBe(true);
    });
  });
});
