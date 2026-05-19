import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Companies (e2e)', () => {
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

    const mockCompany = {
      id: 'company-123',
      name: 'Acme Corp',
      slug: 'acme-corp',
      industry: 'TECHNOLOGY',
      description: 'A tech company',
      website: null,
      logoMediaAssetId: null,
      coverMediaAssetId: null,
      verified: false,
      verifiedAt: null,
      followerCount: 0,
      employeeCount: null,
      foundedYear: null,
      headquarters: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      members: [
        {
          id: 'member-1',
          companyId: 'company-123',
          userId: 'user-123',
          role: 'ADMIN',
          title: null,
          status: 'active',
          joinedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'user-123',
            displayName: 'Test User',
            email: 'test@example.com',
          },
        },
      ],
      logoMediaAsset: null,
      coverMediaAsset: null,
      _count: { followers: 0 },
    };

    const mockCompanyMember = {
      id: 'member-1',
      companyId: 'company-123',
      userId: 'user-123',
      role: 'ADMIN',
      title: null,
      status: 'active',
      joinedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockCompanyFollower = {
      id: 'follower-1',
      companyId: 'company-123',
      userId: 'user-123',
      createdAt: new Date(),
    };

    const mockInvitation = {
      id: 'inv-1',
      companyId: 'company-123',
      email: 'invited@example.com',
      role: 'member',
      token: 'invite-token-123',
      invitedBy: 'user-123',
      status: 'pending',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockRecruiterSeat = {
      id: 'seat-1',
      companyId: 'company-123',
      userId: null,
      status: 'available',
      allocatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const transactionMock = {
      user: { create: jest.fn().mockResolvedValue(mockUser) },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
      company: {
        findUnique: jest.fn().mockImplementation((args: any) => {
          if (args?.where?.slug === 'non-existent') return null;
          return mockCompany;
        }),
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (args?.where?.slug === 'non-existent') return null;
          return mockCompany;
        }),
        findMany: jest.fn().mockResolvedValue([mockCompany]),
        create: jest.fn().mockResolvedValue(mockCompany),
        update: jest.fn().mockResolvedValue(mockCompany),
        count: jest.fn().mockResolvedValue(0),
      },
      companyMember: {
        findUnique: jest.fn().mockResolvedValue(mockCompanyMember),
        findMany: jest.fn().mockResolvedValue([mockCompanyMember]),
        create: jest.fn().mockResolvedValue(mockCompanyMember),
        update: jest.fn().mockResolvedValue(mockCompanyMember),
      },
      companyFollower: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(mockCompanyFollower),
        delete: jest.fn().mockResolvedValue({}),
      },
      memberInvitation: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(mockInvitation),
        update: jest.fn().mockResolvedValue(mockInvitation),
      },
      recruiterSeat: {
        findMany: jest.fn().mockResolvedValue([mockRecruiterSeat]),
        findUnique: jest.fn().mockResolvedValue(mockRecruiterSeat),
        create: jest.fn().mockResolvedValue(mockRecruiterSeat),
        update: jest.fn().mockResolvedValue(mockRecruiterSeat),
      },
      companyEntitlement: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      companyVerification: {
        create: jest.fn(),
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
        company: {
          findUnique: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.slug === 'non-existent') return null;
            if (args?.where?.id === 'non-existent') return null;
            return mockCompany;
          }),
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.slug === 'non-existent') return null;
            if (args?.where?.id === 'non-existent') return null;
            return mockCompany;
          }),
          findMany: jest.fn().mockResolvedValue([mockCompany]),
          create: jest.fn().mockResolvedValue(mockCompany),
          update: jest.fn().mockResolvedValue(mockCompany),
          count: jest.fn().mockResolvedValue(0),
        },
        companyMember: {
          findUnique: jest.fn().mockResolvedValue(mockCompanyMember),
          findMany: jest.fn().mockResolvedValue([mockCompanyMember]),
          create: jest.fn().mockResolvedValue(mockCompanyMember),
          update: jest.fn().mockResolvedValue(mockCompanyMember),
        },
        companyFollower: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockCompanyFollower),
          delete: jest.fn().mockResolvedValue({}),
        },
        memberInvitation: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue(mockInvitation),
          update: jest.fn().mockResolvedValue(mockInvitation),
        },
        recruiterSeat: {
          findMany: jest.fn().mockResolvedValue([mockRecruiterSeat]),
          findUnique: jest.fn().mockResolvedValue(mockRecruiterSeat),
          create: jest.fn().mockResolvedValue(mockRecruiterSeat),
          update: jest.fn().mockResolvedValue(mockRecruiterSeat),
        },
        companyEntitlement: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        companyVerification: {
          create: jest.fn(),
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

  describe('POST /api/v1/companies', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/companies')
        .send({ name: 'Acme Corp' })
        .expect(401);
    });

    it('should create company with auto-generated slug', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Acme Corp',
          industry: 'TECHNOLOGY',
          description: 'A tech company',
        })
        .expect(201);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe('Acme Corp');
      expect(response.body.data.slug).toBe('acme-corp');
    });

    it('should return 400 for invalid industry enum', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Bad Corp',
          industry: 'INVALID_INDUSTRY',
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is missing', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({ industry: 'TECHNOLOGY' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/companies/:slug', () => {
    it('should return company without auth (public endpoint)', async () => {
      const response = await request(app!.getHttpServer())
        .get('/api/v1/companies/acme-corp')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data.name).toBe('Acme Corp');
      expect(response.body.data.slug).toBe('acme-corp');
    });

    it('should return 404 for non-existent slug', async () => {
      await request(app!.getHttpServer())
        .get('/api/v1/companies/non-existent')
        .expect(404);
    });
  });

  describe('POST /api/v1/companies/:id/follow', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/companies/company-123/follow')
        .expect(401);
    });

    it('should follow company with valid token', async () => {
      const token = await generateToken();
      await request(app!.getHttpServer())
        .post('/api/v1/companies/company-123/follow')
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });
  });

  describe('DELETE /api/v1/companies/:id/follow', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .delete('/api/v1/companies/company-123/follow')
        .expect(401);
    });
  });

  describe('PATCH /api/v1/companies/:id', () => {
    it('should return 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .patch('/api/v1/companies/company-123')
        .send({ description: 'Updated description' })
        .expect(401);
    });

    it('should update company with valid token', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .patch('/api/v1/companies/company-123')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(response.body).toHaveProperty('data');
    });
  });
});
