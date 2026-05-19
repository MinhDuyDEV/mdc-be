import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Notifications (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173';
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
    const { EmailProcessor } = jest.requireActual<{
      EmailProcessor: Type<unknown>;
    }>('./../src/email/email.processor');
    const { OutboxService } = jest.requireActual<{
      OutboxService: Type<unknown>;
    }>('./../src/outbox/outbox.service');

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash:
        '$2b$12$LJ3m4ys3nGxDXZQGhVIyqOfYK5CxJNZY7vQQ5pEtZRVL7NW1Oa4Ke',
      displayName: 'Test User',
      emailVerifiedAt: new Date(),
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockNotification = {
      id: 'notif-123',
      userId: 'user-123',
      type: 'ApplicationSubmitted',
      payloadJson: { applicationId: 'app-123' },
      title: 'New application',
      body: 'A candidate applied',
      actionUrl: '/applications/app-123',
      readAt: null,
      createdAt: new Date(),
    };

    const mockNotificationRead = {
      ...mockNotification,
      readAt: new Date(),
    };

    const transactionMock = {
      user: { create: jest.fn().mockResolvedValue(mockUser) },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
      notification: {
        findMany: jest.fn().mockResolvedValue([mockNotification]),
        count: jest.fn().mockResolvedValue(5),
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (args?.where?.id === 'non-existent') return null;
          return mockNotification;
        }),
        update: jest.fn().mockResolvedValue(mockNotificationRead),
        updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
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
          findUnique: jest.fn().mockResolvedValue(mockUser),
          create: jest.fn().mockResolvedValue(mockUser),
          update: jest.fn().mockResolvedValue(mockUser),
        },
        notification: {
          findMany: jest.fn().mockResolvedValue([mockNotification]),
          count: jest.fn().mockResolvedValue(5),
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.id === 'non-existent') return null;
            return mockNotification;
          }),
          update: jest.fn().mockResolvedValue(mockNotificationRead),
          updateMany: jest.fn().mockResolvedValue({ count: 5 }),
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
      .overrideProvider(EmailProcessor)
      .useValue({
        process: jest.fn(),
      })
      .overrideProvider(OutboxService)
      .useValue({
        emit: jest.fn(),
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

  function generateToken(): Promise<string> {
    const jwtService = app!.get(JwtService);
    return jwtService.signAsync({
      sub: 'user-123',
      email: 'test@example.com',
    });
  }

  // -------------------------------------------------------------------------
  // GET /api/v1/notifications
  // -------------------------------------------------------------------------

  describe('GET /api/v1/notifications', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/notifications')
        .expect(401);
    });

    it('should return 200 with notification list and pagination meta', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('hasNextPage');
      expect(response.body.meta).toHaveProperty('limit');
    });

    it('should return 200 when cursor query param is provided', async () => {
      const token = await generateToken();
      const cursor = Buffer.from('2024-01-01T00:00:00.000Z:notif-123').toString(
        'base64url',
      );
      const response = await request(app!.getHttpServer())
        .get(`/api/v1/notifications?cursor=${cursor}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });

    it('should clamp limit > 50 to 50 without returning an error', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .get('/api/v1/notifications?limit=999')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(50);
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/v1/notifications/unread-count
  // -------------------------------------------------------------------------

  describe('GET /api/v1/notifications/unread-count', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .expect(401);
    });

    it('should return 200 with numeric unread count', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('count');
      expect(typeof response.body.data.count).toBe('number');
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/v1/notifications/:id/read
  // -------------------------------------------------------------------------

  describe('PATCH /api/v1/notifications/:id/read', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .patch('/api/v1/notifications/notif-123/read')
        .expect(401);
    });

    it('should return 200 and mark the notification as read', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .patch('/api/v1/notifications/notif-123/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });

    it('should return 404 for a non-existent notification id', async () => {
      const token = await generateToken();
      await request(app!.getHttpServer())
        .patch('/api/v1/notifications/non-existent/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/v1/notifications/read-all
  // -------------------------------------------------------------------------

  describe('POST /api/v1/notifications/read-all', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .expect(401);
    });

    it('should return 200 and report the count of marked notifications', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('count');
      expect(typeof response.body.data.count).toBe('number');
    });
  });
});
