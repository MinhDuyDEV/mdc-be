import * as crypto from 'node:crypto';
import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { REDIS_CLIENT } from '../src/infra/redis/redis.constants';
import { RecommendationsRepository } from '../src/recommendations/recommendations.repository';
import { RecommendationsService } from '../src/recommendations/recommendations.service';

describe('Billing (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;

  const companyId = '00000000-0000-0000-0000-000000000001';
  const planId = '00000000-0000-0000-0000-000000000010';

  const mockPlan = {
    id: planId,
    name: 'Pro Plan',
    slug: 'pro',
    description: 'Pro plan description',
    features: { max_jobs: 10, max_team_members: 5 },
    priceMonthly: 2999,
    priceYearly: 29990,
    isPublic: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscription = {
    id: 'sub-1',
    companyId,
    planId,
    status: 'trialing',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    plan: mockPlan,
  };

  const mockInvoice = {
    id: 'inv-1',
    companyId,
    amount: 2999,
    currency: 'usd',
    status: 'paid',
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentEvent = {
    id: 'pe-1',
    provider: 'stripe',
    providerEventId: 'evt_123',
    eventType: 'invoice.paid',
    payload: {},
    createdAt: new Date(),
  };

  let mockPrisma: Record<string, unknown>;
  let transactionMock: Record<string, unknown>;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.BODY_JSON_LIMIT = '1mb';
    process.env.BODY_URLENCODED_LIMIT = '1mb';
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        'postgresql://mdc:mdc_dev_password@localhost:5432/mdc?schema=public';
    }
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
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-long';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long';
    process.env.COOKIE_SECRET = 'test-cookie-secret-min-32-chars-long';
    process.env.COOKIE_SECURE = 'false';
    process.env.BILLING_WEBHOOK_SECRET = 'whsec_test_secret';

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
    const { OutboxService } = jest.requireActual<{
      OutboxService: Type<unknown>;
    }>('./../src/outbox/outbox.service');

    transactionMock = {
      subscription: {
        create: jest.fn().mockResolvedValue(mockSubscription),
      },
      entitlementGrant: {
        create: jest.fn().mockResolvedValue({}),
      },
      companyEntitlement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      paymentProviderEvent: {
        create: jest.fn().mockResolvedValue(mockPaymentEvent),
      },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
      profileView: { create: jest.fn() },
      companyView: { create: jest.fn() },
      postImpression: { create: jest.fn() },
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        cb(transactionMock),
      ),
      billingPlan: {
        create: jest.fn().mockResolvedValue(mockPlan),
        findMany: jest.fn().mockResolvedValue([mockPlan]),
        findUnique: jest.fn().mockResolvedValue(mockPlan),
        update: jest.fn().mockResolvedValue(mockPlan),
      },
      subscription: {
        create: jest.fn().mockResolvedValue(mockSubscription),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(mockSubscription),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([mockInvoice]),
        findFirst: jest.fn().mockResolvedValue(mockInvoice),
      },
      paymentProviderEvent: {
        create: jest.fn().mockResolvedValue(mockPaymentEvent),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'owner-1', emailVerifiedAt: new Date() }),
        count: jest.fn().mockResolvedValue(0),
      },
      companyMember: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ role: 'OWNER', status: 'active' }),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: companyId }),
      },
      companyEntitlement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        upsert: jest.fn().mockResolvedValue({}),
      },
      entitlementGrant: {
        create: jest.fn().mockResolvedValue({}),
      },
      creditTransaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn(),
      },
      adminUser: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ role: 'SUPER_ADMIN', permissions: [] }),
      },
      outboxEvent: {
        create: jest.fn(),
      },
      profileView: { create: jest.fn() },
      companyView: { create: jest.fn() },
      postImpression: { create: jest.fn() },
      post: { count: jest.fn().mockResolvedValue(0) },
      job: { count: jest.fn().mockResolvedValue(0) },
      application: { count: jest.fn().mockResolvedValue(0) },
      report: { count: jest.fn().mockResolvedValue(0) },
      profile: { findUnique: jest.fn() },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue({
        live: () => ({ status: 'ok', checks: { api: { status: 'up' } } }),
        ready: () => ({
          status: 'ok',
          checks: {
            postgres: { status: 'up' },
            redis: { status: 'up' },
            s3: { status: 'up' },
            elasticsearch: { status: 'up' },
            mail: { status: 'up' },
          },
        }),
      })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideProvider(StorageService)
      .useValue({
        generatePresignedUploadUrl: jest.fn(),
        generatePresignedDownloadUrl: jest.fn(),
        headBucket: jest.fn(),
      })
      .overrideProvider(StorageHealthService)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(SearchEngineService)
      .useValue({
        checkClusterHealth: jest.fn(),
        index: jest.fn(),
        search: jest.fn(),
        deleteByQuery: jest.fn(),
      })
      .overrideProvider(SearchEngineHealthService)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(MailerService)
      .useValue({
        sendMail: jest.fn().mockResolvedValue(undefined),
        verifyConnection: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(MailerHealthService)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
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
      .useValue({ processOutbox: jest.fn(), claimEvents: jest.fn() })
      .overrideProvider(DeadLetterService)
      .useValue({ moveToDeadLetter: jest.fn(), replay: jest.fn() })
      .overrideProvider(IdempotencyService)
      .useValue({
        claim: jest.fn().mockResolvedValue({ id: 'k1' }),
        cleanup: jest.fn(),
      })
      .overrideProvider(OutboxService)
      .useValue({ emit: jest.fn() })
      .overrideProvider(REDIS_CLIENT)
      .useValue({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        keys: jest.fn(),
        mget: jest.fn(),
        pipeline: jest.fn().mockReturnValue({ exec: jest.fn() }),
      })
      .overrideProvider(RecommendationsService)
      .useValue({
        getRecommendations: jest.fn(),
        getJobRecommendations: jest.fn(),
        getPersonRecommendations: jest.fn(),
        getCompanyRecommendations: jest.fn(),
      })
      .overrideProvider(RecommendationsRepository)
      .useValue({
        findJobRecommendations: jest.fn(),
        findPersonRecommendations: jest.fn(),
        findCompanyRecommendations: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    process.env = originalEnv;
  });

  function tokenFor(userId: string, email: string): Promise<string> {
    const jwt = app!.get(JwtService);
    return jwt.signAsync({ sub: userId, email });
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/billing/plans
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/billing/plans', () => {
    it('returns plans without auth', async () => {
      const res = await request(app!.getHttpServer())
        .get('/api/v1/billing/plans')
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/billing/admin/plans
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/billing/admin/plans', () => {
    const path = '/api/v1/billing/admin/plans';

    it('returns 401 without auth', async () => {
      await request(app!.getHttpServer())
        .post(path)
        .send({
          name: 'Pro Plan',
          slug: 'pro',
          features: { max_jobs: 10 },
          priceMonthly: 2999,
        })
        .expect(401);
    });

    it('admin creates plan and GET /billing/plans returns it', async () => {
      const token = await tokenFor('admin-1', 'admin@example.com');

      const createRes = await request(app!.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Pro Plan',
          slug: 'pro',
          features: { max_jobs: 10 },
          priceMonthly: 2999,
        })
        .expect(201);
      expect(createRes.body.data).toBeDefined();
      expect(createRes.body.data.name).toBe('Pro Plan');

      const listRes = await request(app!.getHttpServer())
        .get('/api/v1/billing/plans')
        .expect(200);
      expect(listRes.body.data).toBeDefined();
      expect(Array.isArray(listRes.body.data)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/billing/companies/:companyId/subscription
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/billing/companies/:companyId/subscription', () => {
    const path = `/api/v1/billing/companies/${companyId}/subscription`;

    it('returns 401 without auth', async () => {
      await request(app!.getHttpServer())
        .post(path)
        .send({ planId })
        .expect(401);
    });

    it('company owner creates subscription', async () => {
      const token = await tokenFor('owner-1', 'owner@example.com');

      const res = await request(app!.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({ planId })
        .expect(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.status).toBe('trialing');
    });

    it('non-owner cannot create subscription (403)', async () => {
      (
        mockPrisma.companyMember as {
          findUnique: jest.Mock;
        }
      ).findUnique.mockResolvedValue({ role: 'MEMBER', status: 'active' });

      const token = await tokenFor('member-1', 'member@example.com');

      await request(app!.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({ planId })
        .expect(403);
    });

    it('unverified user cannot create subscription (403)', async () => {
      (
        mockPrisma.user as {
          findUnique: jest.Mock;
        }
      ).findUnique.mockResolvedValue({
        id: 'unverified-1',
        emailVerifiedAt: null,
      });

      const token = await tokenFor('unverified-1', 'unverified@example.com');

      await request(app!.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({ planId })
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/billing/companies/:companyId/subscription
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/billing/companies/:companyId/subscription', () => {
    const path = `/api/v1/billing/companies/${companyId}/subscription`;

    it('returns 401 without auth', async () => {
      await request(app!.getHttpServer()).get(path).expect(401);
    });

    it('company owner can view subscription', async () => {
      (
        mockPrisma.subscription as {
          findUnique: jest.Mock;
        }
      ).findUnique.mockResolvedValue(mockSubscription);

      const token = await tokenFor('owner-1', 'owner@example.com');

      const res = await request(app!.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/billing/companies/:companyId/invoices
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/billing/companies/:companyId/invoices', () => {
    const path = `/api/v1/billing/companies/${companyId}/invoices`;

    it('returns 401 without auth', async () => {
      await request(app!.getHttpServer()).get(path).expect(401);
    });

    it('billing admin can list invoices', async () => {
      (
        mockPrisma.companyMember as {
          findUnique: jest.Mock;
        }
      ).findUnique.mockResolvedValue({
        role: 'BILLING_ADMIN',
        status: 'active',
      });

      const token = await tokenFor('billing-admin-1', 'billing@example.com');

      const res = await request(app!.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('regular member cannot list invoices (403)', async () => {
      (
        mockPrisma.companyMember as {
          findUnique: jest.Mock;
        }
      ).findUnique.mockResolvedValue({ role: 'MEMBER', status: 'active' });

      const token = await tokenFor('member-1', 'member@example.com');

      await request(app!.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/billing/webhooks/:provider
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/billing/webhooks/:provider', () => {
    const path = '/api/v1/billing/webhooks/stripe';

    it('webhook with valid signature returns 200', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const body = { type: 'invoice.paid', data: { invoiceId: 'inv-1' } };
      const payload = JSON.stringify(body);
      const secret = 'whsec_test_secret';
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

      const res = await request(app!.getHttpServer())
        .post(path)
        .set('x-webhook-signature', signature)
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-id', 'evt_123')
        .send(body)
        .expect(200);
      expect(res.body.received).toBe(true);
    });

    it('webhook with invalid signature returns 401', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();

      await request(app!.getHttpServer())
        .post(path)
        .set('x-webhook-signature', 'invalid-signature')
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-id', 'evt_456')
        .send({ type: 'invoice.paid' })
        .expect(401);
    });
  });
});
