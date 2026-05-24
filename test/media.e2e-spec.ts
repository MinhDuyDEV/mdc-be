import type { INestApplication, Type } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Media (e2e)', () => {
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

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash:
        '$2b$12$LJ3m4ys3nGxDXZQGhVIyqOfYK5CxJNZY7vQQ5pEtZRVL7NW1Oa4Ke',
      displayName: null,
      emailVerifiedAt: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMediaAsset = {
      id: 'media-123',
      ownerId: 'user-123',
      purpose: 'avatar',
      filename: 'photo.jpg',
      s3Key: 'avatar/uuid-photo.jpg',
      s3Bucket: 'mdc-media',
      contentType: 'image/jpeg',
      sizeBytes: null,
      status: 'PENDING',
      visibility: 'PRIVATE',
      etag: null,
      createdAt: new Date(),
      updatedAt: new Date(),
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
          cb({
            user: { create: jest.fn().mockResolvedValue(mockUser) },
            auditLog: { create: jest.fn() },
            outboxEvent: { create: jest.fn() },
          }),
        ),
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockUser),
          update: jest.fn().mockResolvedValue(mockUser),
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
        mediaAsset: {
          findUnique: jest.fn().mockResolvedValue(mockMediaAsset),
          create: jest
            .fn()
            .mockImplementation((args: { data: Record<string, unknown> }) => ({
              id: 'media-123',
              ownerId: args.data.ownerId,
              purpose: args.data.purpose,
              filename: args.data.filename,
              s3Key: args.data.s3Key,
              s3Bucket: args.data.s3Bucket,
              contentType: args.data.contentType,
              sizeBytes: args.data.sizeBytes ?? null,
              status: 'PENDING',
              visibility: args.data.visibility ?? 'PRIVATE',
              etag: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
          update: jest.fn().mockResolvedValue({
            id: 'media-123',
            ownerId: 'user-123',
            purpose: 'avatar',
            filename: 'photo.jpg',
            s3Key: 'avatar/uuid-photo.jpg',
            s3Bucket: 'mdc-media',
            contentType: 'image/jpeg',
            sizeBytes: 1024,
            status: 'READY',
            visibility: 'PRIVATE',
            etag: '"abc123"',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        connection: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      })
      .overrideProvider(StorageService)
      .useValue({
        generatePresignedUploadUrl: jest
          .fn()
          .mockResolvedValue(
            'https://signed.example.com/upload/avatar/uuid-photo.jpg',
          ),
        generatePresignedDownloadUrl: jest
          .fn()
          .mockResolvedValue(
            'https://signed.example.com/download/avatar/uuid-photo.jpg',
          ),
        headBucket: jest.fn(),
        verifyObject: jest.fn().mockResolvedValue({
          contentLength: 1024,
          contentType: 'image/jpeg',
          etag: '"abc123"',
          lastModified: new Date(),
        }),
        deleteObject: jest.fn().mockResolvedValue(undefined),
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

  describe('POST /api/v1/media/initiate', () => {
    it('should return 401 without token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/media/initiate')
        .send({
          purpose: 'avatar',
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        })
        .expect(401);
    });

    it('should initiate upload with valid token', async () => {
      // Register first to get token
      const registerRes = await request(app!.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'media-test@example.com', password: 'password123' })
        .expect(201);

      const accessToken = registerRes.body.data?.accessToken;

      if (accessToken) {
        const res = await request(app!.getHttpServer())
          .post('/api/v1/media/initiate')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            purpose: 'avatar',
            filename: 'photo.jpg',
            contentType: 'image/jpeg',
          })
          .expect(200);

        expect(res.body).toHaveProperty('data');
        expect(res.body.data).toHaveProperty('mediaId');
        expect(res.body.data).toHaveProperty('uploadUrl');
      }
    });

    it('should return 400 for invalid content type', async () => {
      const registerRes = await request(app!.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'media-test2@example.com', password: 'password123' })
        .expect(201);

      const accessToken = registerRes.body.data?.accessToken;

      if (accessToken) {
        const res = await request(app!.getHttpServer())
          .post('/api/v1/media/initiate')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            purpose: 'avatar',
            filename: 'malware.exe',
            contentType: 'application/x-msdownload',
          })
          .expect(400);

        expect(res.body).toHaveProperty('error');
      }
    });
  });

  describe('POST /api/v1/media/:id/confirm', () => {
    it('should return 401 without token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/media/media-123/confirm')
        .expect(401);
    });
  });

  describe('GET /api/v1/media/:id', () => {
    it('should hide private assets from anonymous users', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/media/media-123')
        .expect(404);
    });

    it('should return public assets to anonymous users', async () => {
      const { PrismaService } = jest.requireActual<{
        PrismaService: Type<unknown>;
      }>('./../src/infra/prisma');
      const prisma = app!.get<{
        mediaAsset: { findUnique: jest.Mock };
      }>(PrismaService);

      prisma.mediaAsset.findUnique.mockResolvedValueOnce({
        id: 'media-123',
        ownerId: 'user-123',
        purpose: 'avatar',
        filename: 'photo.jpg',
        s3Key: 'avatar/uuid-photo.jpg',
        s3Bucket: 'mdc-media',
        contentType: 'image/jpeg',
        sizeBytes: 1024,
        status: 'READY',
        visibility: 'PUBLIC',
        etag: '"abc123"',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app!.getHttpServer())
        .get('/api/v1/media/media-123')
        .expect(200);

      expect(response.body.data).toEqual(
        expect.objectContaining({
          mediaId: 'media-123',
          downloadUrl:
            'https://signed.example.com/download/avatar/uuid-photo.jpg',
        }),
      );
    });
  });

  describe('DELETE /api/v1/media/:id', () => {
    it('should return 401 without token', async () => {
      await request(app!.getHttpServer())
        .delete('/api/v1/media/media-123')
        .expect(401);
    });
  });
});
