import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Profiles (e2e)', () => {
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
      displayName: null,
      emailVerifiedAt: null,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockProfile = {
      id: 'profile-123',
      userId: 'user-123',
      headline: 'Senior Developer',
      about: 'Experienced engineer',
      location: 'San Francisco',
      website: 'https://example.com',
      openToWork: true,
      recruitingEligible: false,
      visibility: 'PUBLIC',
      searchVector: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      skills: [
        {
          id: 'skill-1',
          profileId: 'profile-123',
          name: 'TypeScript',
          category: 'LANGUAGE',
          proficiency: 'EXPERT',
          createdAt: new Date(),
        },
      ],
      experiences: [],
      educations: [],
      certifications: [],
      languages: [],
      endorsements: [],
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
        $queryRaw: jest.fn().mockImplementation((query: unknown) => {
          if (
            typeof query === 'string' &&
            query.includes('websearch_to_tsquery')
          ) {
            return [
              {
                id: 'profile-123',
                user_id: 'user-123',
                headline: 'Senior Developer',
                about: 'Experienced',
                location: 'SF',
                website: null,
                open_to_work: true,
                recruiting_eligible: false,
                visibility: 'PUBLIC',
                created_at: new Date(),
                updated_at: new Date(),
                rank: 0.5,
                total_count: 1,
              },
            ];
          }
          return [{ '?column?': 1 }];
        }),
        $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
          cb({
            user: { create: jest.fn().mockResolvedValue(mockUser) },
            auditLog: { create: jest.fn() },
            outboxEvent: { create: jest.fn() },
            profile: {
              findUnique: jest.fn().mockResolvedValue(mockProfile),
              create: jest.fn().mockResolvedValue(mockProfile),
              update: jest.fn().mockResolvedValue(mockProfile),
            },
            profileSkill: {
              findMany: jest.fn().mockResolvedValue([]),
              createMany: jest.fn(),
              deleteMany: jest.fn(),
              findUnique: jest.fn().mockResolvedValue({
                id: 'skill-1',
                profileId: 'profile-123',
                name: 'TypeScript',
                profile: { userId: 'user-456' },
              }),
            },
            experience: {
              findMany: jest.fn().mockResolvedValue([]),
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            education: {
              findMany: jest.fn().mockResolvedValue([]),
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            certification: {
              findMany: jest.fn().mockResolvedValue([]),
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            profileLanguage: {
              findMany: jest.fn().mockResolvedValue([]),
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            endorsement: {
              create: jest.fn().mockResolvedValue({
                id: 'end-1',
                profileId: 'profile-123',
                profileSkillId: 'skill-1',
                endorserId: 'user-456',
                createdAt: new Date(),
              }),
              findUnique: jest.fn().mockResolvedValue(null),
              delete: jest.fn().mockResolvedValue({}),
            },
          }),
        ),
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockUser),
          update: jest.fn().mockResolvedValue(mockUser),
        },
        profile: {
          findUnique: jest.fn().mockResolvedValue(mockProfile),
          create: jest.fn().mockResolvedValue(mockProfile),
          update: jest.fn().mockResolvedValue(mockProfile),
        },
        profileSkill: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({
            id: 'skill-1',
            profileId: 'profile-123',
            name: 'TypeScript',
            profile: { userId: 'user-456' },
          }),
        },
        experience: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        education: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        certification: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        profileLanguage: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        endorsement: {
          create: jest.fn().mockResolvedValue({
            id: 'end-1',
            profileId: 'profile-123',
            profileSkillId: 'skill-1',
            endorserId: 'user-456',
            createdAt: new Date(),
          }),
          findUnique: jest.fn().mockResolvedValue(null),
          delete: jest.fn().mockResolvedValue({}),
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

  describe('GET /api/v1/profiles/me', () => {
    it('should return 401 without token', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/profiles/me')
        .expect(401);
    });

    it('should return own profile with valid token', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('PATCH /api/v1/profiles/me', () => {
    it('should return 401 without token', async () => {
      await request(app!.getHttpServer())
        .patch('/api/v1/profiles/me')
        .send({ headline: 'New Headline' })
        .expect(401);
    });

    it('should update profile with valid token', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .patch('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ headline: 'New Headline' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /api/v1/profiles/search', () => {
    it('should return search results', async () => {
      const response = await request(app!.getHttpServer())
        .get('/api/v1/profiles/search?q=react')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
    });
  });

  describe('POST /api/v1/profiles/:userId/skills/:skillId/endorse', () => {
    it('should return 401 without token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/profiles/user-123/skills/skill-1/endorse')
        .expect(401);
    });

    it('should endorse skill with valid token', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post('/api/v1/profiles/user-123/skills/skill-1/endorse')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(response.body).toHaveProperty('data');
    });
  });
});
