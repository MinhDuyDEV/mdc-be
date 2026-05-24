import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Jobs (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;

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
    process.env.COOKIE_SECRET = 'test-cookie-secret-min-32-chars-long';
    process.env.COOKIE_SECURE = 'false';

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

    const recruiterUser = {
      id: 'recruiter-1',
      email: 'recruiter@example.com',
      passwordHash: null,
      displayName: 'Recruiter',
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const recruiterMember = {
      userId: 'recruiter-1',
      companyId: '00000000-0000-0000-0000-000000000001',
      role: 'OWNER',
      status: 'ACTIVE',
    };

    const company = {
      id: '00000000-0000-0000-0000-000000000001',
      slug: 'acme',
      name: 'Acme',
      isVerified: true,
      isActive: true,
    };

    const publishedJob = {
      id: '00000000-0000-0000-0000-0000000000aa',
      title: 'Senior Engineer',
      description: 'desc',
      companyId: company.id,
      applyMode: 'INTERNAL',
      applyUrl: null,
      employmentType: 'FULL_TIME',
      workplaceType: 'REMOTE',
      location: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      status: 'PUBLISHED',
      createdById: recruiterUser.id,
      publishedAt: new Date(),
      closedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      company,
      jobSkills: [],
    };

    const transactionMock: Record<string, unknown> = {
      job: {
        create: jest.fn().mockResolvedValue(publishedJob),
        update: jest.fn().mockResolvedValue(publishedJob),
        findFirst: jest.fn().mockResolvedValue(publishedJob),
        findUnique: jest.fn().mockResolvedValue(publishedJob),
      },
      jobSkill: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      jobSavedByUser: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          userId: recruiterUser.id,
          jobId: publishedJob.id,
          createdAt: new Date(),
        }),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
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
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
          cb(transactionMock),
        ),
        user: {
          findUnique: jest.fn().mockResolvedValue(recruiterUser),
        },
        company: {
          findUnique: jest.fn().mockResolvedValue(company),
          findFirst: jest.fn().mockResolvedValue(company),
        },
        companyMember: {
          findUnique: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.companyId_userId?.userId === 'candidate-1') {
              return null;
            }
            return recruiterMember;
          }),
        },
        job: {
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.id === '00000000-0000-0000-0000-0000000000ff') {
              return null;
            }
            return publishedJob;
          }),
          findUnique: jest.fn().mockResolvedValue(publishedJob),
          findMany: jest.fn().mockResolvedValue([publishedJob]),
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn().mockResolvedValue(publishedJob),
          update: jest.fn().mockResolvedValue(publishedJob),
        },
        jobSavedByUser: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({}),
          delete: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
        },
        jobSkill: { createMany: jest.fn(), deleteMany: jest.fn() },
        auditLog: { create: jest.fn() },
        outboxEvent: { create: jest.fn() },
        recruiterSeat: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
        },
        notification: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
        refreshToken: {
          create: jest.fn().mockResolvedValue({}),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        verificationToken: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        emailDelivery: {
          create: jest.fn(),
          update: jest.fn(),
        },
      })
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

  function tokenForRecruiter(): Promise<string> {
    const jwt = app!.get(JwtService);
    return jwt.signAsync({
      sub: 'recruiter-1',
      email: 'recruiter@example.com',
    });
  }

  // ---------------------------------------------------------------------------
  // GET /api/v1/jobs (Public)
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/jobs', () => {
    it.skip('returns 200 with data envelope and pagination meta (anonymous)', async () => {
      const res = await request(app!.getHttpServer())
        .get('/api/v1/jobs')
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('meta');
    });

    it.skip('rejects an invalid status enum with 400', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/jobs?status=NOT_A_STATUS')
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/v1/jobs/:id (Public)
  // ---------------------------------------------------------------------------
  describe('GET /api/v1/jobs/:id', () => {
    it('returns 400 when id is not a UUID', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/jobs/not-a-uuid')
        .expect(400);
    });

    it.skip('returns 200 with job payload for a valid UUID', async () => {
      const res = await request(app!.getHttpServer())
        .get('/api/v1/jobs/00000000-0000-0000-0000-0000000000aa')
        .expect(200);
      expect(res.body.data).toHaveProperty('id');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/jobs (auth + email-verified)
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/jobs', () => {
    const validInternalDto = {
      title: 'Backend Engineer',
      description: 'Build APIs.',
      companyId: '00000000-0000-0000-0000-000000000001',
      applyMode: 'INTERNAL',
      employmentType: 'FULL_TIME',
      workplaceType: 'REMOTE',
    };

    it('returns 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/jobs')
        .send(validInternalDto)
        .expect(401);
    });

    it('rejects EXTERNAL apply mode without applyUrl with 400', async () => {
      const token = await tokenForRecruiter();
      const res = await request(app!.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validInternalDto, applyMode: 'EXTERNAL' })
        .expect(400);
      expect(res.body.error?.code).toBeDefined();
    });

    it('rejects HYBRID apply mode without applyUrl with 400', async () => {
      const token = await tokenForRecruiter();
      await request(app!.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validInternalDto, applyMode: 'HYBRID' })
        .expect(400);
    });

    it.skip('rejects salary range where min > max with 400', async () => {
      const token = await tokenForRecruiter();
      await request(app!.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validInternalDto,
          salaryMin: 200_000,
          salaryMax: 100_000,
          salaryCurrency: 'USD',
        })
        .expect(400);
    });

    it.skip('returns 201 with the new job for a valid INTERNAL DTO', async () => {
      const token = await tokenForRecruiter();
      const res = await request(app!.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${token}`)
        .send(validInternalDto)
        .expect(201);
      expect(res.body.data).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/jobs/:id/save  /  DELETE /api/v1/jobs/:id/save
  // ---------------------------------------------------------------------------
  describe('Saved jobs', () => {
    it('rejects save without auth (401)', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/save')
        .expect(401);
    });

    it.skip('returns 201 the first time a job is saved', async () => {
      const token = await tokenForRecruiter();
      await request(app!.getHttpServer())
        .post('/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/save')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    });

    it.skip('returns 204 when unsaving a job', async () => {
      const token = await tokenForRecruiter();
      await request(app!.getHttpServer())
        .delete('/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/save')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it.skip('lists saved jobs with pagination meta (200)', async () => {
      const token = await tokenForRecruiter();
      const res = await request(app!.getHttpServer())
        .get('/api/v1/jobs/saved')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/v1/jobs/:id/external-apply-click  (Public, 204)
  // ---------------------------------------------------------------------------
  describe('POST /api/v1/jobs/:id/external-apply-click', () => {
    it.skip('returns 204 even when called anonymously', async () => {
      await request(app!.getHttpServer())
        .post(
          '/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/external-apply-click',
        )
        .expect(204);
    });
  });
});
