import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Phase 4 Vertical Slice (e2e)', () => {
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
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long';
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

    const candidateUser = {
      id: 'candidate-1',
      email: 'candidate@example.com',
      passwordHash: null,
      displayName: 'Candidate',
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const job = {
      id: '00000000-0000-0000-0000-0000000000aa',
      companyId: '00000000-0000-0000-0000-000000000001',
      status: 'PUBLISHED',
      applyMode: 'INTERNAL',
      applyUrl: null,
    };

    const application = {
      id: '00000000-0000-0000-0000-0000000000bb',
      jobId: job.id,
      userId: candidateUser.id,
      status: 'SUBMITTED',
      coverLetter: null,
      screeningAnswers: null,
      resumeMediaAssetId: null,
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      job,
      answers: [],
      attachments: [],
      statusEvents: [],
    };

    const reviewedApplication = {
      ...application,
      status: 'REVIEWED',
    };

    const notification = {
      id: '00000000-0000-0000-0000-0000000000ff',
      userId: candidateUser.id,
      type: 'ApplicationStatusChanged',
      payloadJson: { applicationId: application.id, newStatus: 'REVIEWED' },
      title: 'Application reviewed',
      body: 'Your application has been reviewed',
      actionUrl: `/applications/${application.id}`,
      readAt: null,
      createdAt: new Date(),
    };

    const transactionMock: Record<string, unknown> = {
      application: {
        create: jest.fn().mockResolvedValue(application),
        update: jest.fn().mockResolvedValue(reviewedApplication),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(application),
      },
      applicationStatusEvent: { create: jest.fn() },
      applicationNote: {
        create: jest.fn().mockResolvedValue({
          id: 'note-1',
          applicationId: application.id,
          authorUserId: candidateUser.id,
          content: 'note',
          createdAt: new Date(),
        }),
      },
      notification: {
        create: jest.fn().mockResolvedValue(notification),
        findMany: jest.fn().mockResolvedValue([notification]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (args?.where?.userId !== candidateUser.id) return null;
          return notification;
        }),
        update: jest
          .fn()
          .mockResolvedValue({ ...notification, readAt: new Date() }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
        user: { findUnique: jest.fn().mockResolvedValue(candidateUser) },
        job: {
          findFirst: jest.fn().mockResolvedValue(job),
          findUnique: jest.fn().mockResolvedValue(job),
          findMany: jest.fn().mockResolvedValue([job]),
          count: jest.fn().mockResolvedValue(1),
        },
        companyMember: {
          findUnique: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.companyId_userId?.userId === 'candidate-1') {
              return null;
            }
            return {
              userId: 'recruiter-1',
              companyId: '00000000-0000-0000-0000-000000000001',
              role: 'OWNER',
            };
          }),
        },
        recruiterSeat: {
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.userId !== 'recruiter-1') return null;
            return {
              companyId: '00000000-0000-0000-0000-000000000001',
              userId: 'recruiter-1',
            };
          }),
        },
        mediaAsset: {
          findUnique: jest.fn().mockResolvedValue({
            id: '00000000-0000-0000-0000-0000000000cc',
            ownerUserId: candidateUser.id,
            purpose: 'resume',
            status: 'CONFIRMED',
          }),
        },
        application: {
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(application),
          findMany: jest.fn().mockResolvedValue([application]),
          count: jest.fn().mockResolvedValue(1),
          create: jest.fn().mockResolvedValue(application),
          update: jest.fn().mockResolvedValue(reviewedApplication),
        },
        applicationStatusEvent: { create: jest.fn() },
        applicationNote: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue({
            id: 'note-1',
            applicationId: application.id,
            authorUserId: candidateUser.id,
            content: 'note',
            createdAt: new Date(),
          }),
        },
        notification: {
          findMany: jest.fn().mockResolvedValue([notification]),
          count: jest.fn().mockResolvedValue(1),
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.userId !== candidateUser.id) return null;
            return notification;
          }),
          update: jest
            .fn()
            .mockResolvedValue({ ...notification, readAt: new Date() }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        idempotencyKey: {
          create: jest.fn().mockResolvedValue({ id: 'ik-1' }),
          findUnique: jest.fn().mockResolvedValue(null),
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
        auditLog: { create: jest.fn() },
        outboxEvent: { create: jest.fn() },
      })
      .overrideProvider(StorageService)
      .useValue({
        generatePresignedUploadUrl: jest.fn(),
        generatePresignedDownloadUrl: jest
          .fn()
          .mockResolvedValue('https://example.com/resume.pdf'),
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

  function tokenFor(userId: string, email: string): Promise<string> {
    const jwt = app!.get(JwtService);
    return jwt.signAsync({ sub: userId, email });
  }

  // ────────────────────────────────────────────────────────────────────────
  // Full vertical slice: apply → review → notify
  // ────────────────────────────────────────────────────────────────────────

  it('walks Phase 4 flow: candidate applies, recruiter reviews, notification delivered', async () => {
    const recruiterToken = await tokenFor(
      'recruiter-1',
      'recruiter@example.com',
    );
    const candidateToken = await tokenFor(
      'candidate-1',
      'candidate@example.com',
    );

    // Step 1: Candidate submits application
    const submitRes = await request(app!.getHttpServer())
      .post('/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/applications')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ coverLetter: 'I am interested' })
      .expect(201);
    expect(submitRes.body.data).toBeDefined();

    // Step 2: Recruiter lists applications for the job
    const listRes = await request(app!.getHttpServer())
      .get('/api/v1/jobs/00000000-0000-0000-0000-0000000000aa/applications')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .expect(200);
    expect(listRes.body).toHaveProperty('data');
    expect(listRes.body).toHaveProperty('meta');

    // Step 3: Recruiter updates status to REVIEWED
    const statusRes = await request(app!.getHttpServer())
      .patch('/api/v1/applications/00000000-0000-0000-0000-0000000000bb/status')
      .set('Authorization', `Bearer ${recruiterToken}`)
      .send({ newStatus: 'REVIEWED' })
      .expect(200);
    expect(statusRes.body.data).toBeDefined();

    // Step 4: Candidate receives notification
    const notifListRes = await request(app!.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(200);
    expect(notifListRes.body).toHaveProperty('data');
    expect(Array.isArray(notifListRes.body.data)).toBe(true);

    // Step 5: Candidate marks notification as read
    const markReadRes = await request(app!.getHttpServer())
      .patch('/api/v1/notifications/00000000-0000-0000-0000-0000000000ff/read')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(200);
    expect(markReadRes.body.data).toBeDefined();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Authorization cross-check: candidate cannot use recruiter endpoints
  // ────────────────────────────────────────────────────────────────────────

  it('blocks candidate from recruiter-only operations', async () => {
    const candidateToken = await tokenFor(
      'candidate-1',
      'candidate@example.com',
    );
    const otherToken = await tokenFor('recruiter-1', 'recruiter@example.com');

    // Candidate cannot update application status
    await request(app!.getHttpServer())
      .patch('/api/v1/applications/00000000-0000-0000-0000-0000000000bb/status')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({ newStatus: 'REVIEWED' })
      .expect(403);

    // Other user cannot mark candidate's notification as read
    await request(app!.getHttpServer())
      .patch('/api/v1/notifications/00000000-0000-0000-0000-0000000000ff/read')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });
});
