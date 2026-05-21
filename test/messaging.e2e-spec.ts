import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { RecruitingPolicyService } from '../src/recruiting/recruiting-policy.service';

describe('Messaging (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;
  let PrismaService: Type<unknown>;

  const userId = '123e4567-e89b-12d3-a456-426614174000';
  const otherUserId = '123e4567-e89b-12d3-a456-426614174001';
  const conversationId = '123e4567-e89b-12d3-a456-426614174100';
  const messageId = '123e4567-e89b-12d3-a456-426614174200';

  const mockConversation = {
    id: conversationId,
    type: 'DIRECT',
    title: null,
    lastMessageAt: new Date(),
    lastMessagePreview: 'Hello',
    createdAt: new Date(),
    updatedAt: new Date(),
    participants: [
      {
        id: 'p1',
        userId,
        role: 'MEMBER',
        lastReadAt: null,
        joinedAt: new Date(),
      },
      {
        id: 'p2',
        userId: otherUserId,
        role: 'MEMBER',
        lastReadAt: null,
        joinedAt: new Date(),
      },
    ],
  };

  const mockMessage = {
    id: messageId,
    conversationId,
    senderId: userId,
    content: 'Hello',
    type: 'TEXT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.BODY_JSON_LIMIT = '1mb';
    process.env.BODY_URLENCODED_LIMIT = '1mb';
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        'postgresql://postgres:postgres@localhost:5432/mdc_test?schema=public';
    }
    if (!process.env.REDIS_URL) {
      process.env.REDIS_URL = 'redis://localhost:6379';
    }
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
    const { PrismaService: PS } = jest.requireActual<{
      PrismaService: Type<unknown>;
    }>('./../src/infra/prisma');
    PrismaService = PS;
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
    }>('./../src/outbox');
    const { NotificationProcessor } = jest.requireActual<{
      NotificationProcessor: Type<unknown>;
    }>('./../src/outbox/processors/notification.processor');
    const { MessagingProcessor } = jest.requireActual<{
      MessagingProcessor: Type<unknown>;
    }>('./../src/outbox/processors/messaging.processor');

    const transactionMock: Record<string, unknown> = {
      conversation: {
        create: jest.fn().mockResolvedValue(mockConversation),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([mockConversation]),
        findUnique: jest.fn().mockResolvedValue(mockConversation),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      conversationParticipant: {
        createMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          userId,
          conversationId,
        }),
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId }, { userId: otherUserId }]),
        update: jest.fn(),
      },
      message: {
        create: jest.fn().mockResolvedValue(mockMessage),
        findMany: jest.fn().mockResolvedValue([mockMessage]),
      },
      outboxEvent: { create: jest.fn() },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue({
        live: jest.fn().mockResolvedValue({ status: 'ok' }),
        ready: jest.fn().mockResolvedValue({ status: 'ok' }),
      })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
        $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
          cb(transactionMock),
        ),
        conversation: {
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([mockConversation]),
          findUnique: jest.fn().mockResolvedValue(mockConversation),
          create: jest.fn().mockResolvedValue(mockConversation),
        },
        conversationParticipant: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'p1',
            userId,
            conversationId,
          }),
          findMany: jest
            .fn()
            .mockResolvedValue([{ userId }, { userId: otherUserId }]),
          update: jest.fn(),
        },
        message: {
          findMany: jest.fn().mockResolvedValue([mockMessage]),
          create: jest.fn().mockResolvedValue(mockMessage),
        },
        block: { findFirst: jest.fn().mockResolvedValue(null) },
        user: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: userId, emailVerifiedAt: new Date() }),
        },
        notification: { findFirst: jest.fn(), create: jest.fn() },
        outboxEvent: { create: jest.fn() },
      })
      .overrideProvider(OutboxProcessor)
      .useValue({ processOutbox: jest.fn() })
      .overrideProvider(DeadLetterService)
      .useValue({ moveToDeadLetter: jest.fn() })
      .overrideProvider(IdempotencyService)
      .useValue({ claim: jest.fn().mockResolvedValue({}) })
      .overrideProvider(OutboxService)
      .useValue({ emit: jest.fn() })
      .overrideProvider(NotificationProcessor)
      .useValue({ processConnectionRequested: jest.fn() })
      .overrideProvider(MessagingProcessor)
      .useValue({ processMessageSent: jest.fn() })
      .overrideProvider(StorageService)
      .useValue({})
      .overrideProvider(StorageHealthService)
      .useValue({})
      .overrideProvider(SearchEngineService)
      .useValue({})
      .overrideProvider(SearchEngineHealthService)
      .useValue({})
      .overrideProvider(MailerService)
      .useValue({})
      .overrideProvider(MailerHealthService)
      .useValue({})
      .overrideProvider(SearchIndexService)
      .useValue({})
      .overrideProvider(SearchService)
      .useValue({})
      .overrideProvider(EmailProcessor)
      .useValue({})
      .overrideProvider(RecruitingPolicyService)
      .useValue({
        canMessageCandidate: jest
          .fn()
          .mockResolvedValue({ allowed: true, reason: 'OPT_IN' }),
      })
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  const generateToken = async (): Promise<string> => {
    return app!.get(JwtService).sign({ sub: userId });
  };

  describe('POST /api/v1/conversations', () => {
    it('creates a new conversation', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [otherUserId] })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(conversationId);
    });

    it('returns 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .send({ participantIds: [otherUserId] })
        .expect(401);
    });

    it('returns 400 for self-conversation', async () => {
      const token = await generateToken();
      await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [userId] })
        .expect(400);
    });
  });

  describe('GET /api/v1/conversations', () => {
    it('lists user conversations', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/conversations/:id/messages', () => {
    it('sends a message', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello' })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.content).toBe('Hello');
    });

    it('returns 403 for non-participant', async () => {
      const prisma = app!.get(PrismaService);
      prisma.conversationParticipant.findFirst.mockResolvedValueOnce(null);

      const token = await generateToken();
      await request(app!.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello' })
        .expect(403);
    });

    it('returns 403 when sender is blocked', async () => {
      const prisma = app!.get(PrismaService);
      // conversationParticipant.findFirst returns active participant
      prisma.conversationParticipant.findFirst.mockResolvedValue({
        id: 'p1',
        userId,
        conversationId,
      });
      // conversationParticipant.findMany returns both participants
      prisma.conversationParticipant.findMany.mockResolvedValue([
        { userId },
        { userId: otherUserId },
      ]);
      // block.findFirst returns a block → isBlocked returns true
      prisma.block.findFirst.mockResolvedValue({ id: 'block-1' });

      const token = await generateToken();
      await request(app!.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello' })
        .expect(403);
    });
  });

  describe('GET /api/v1/conversations/:id/messages', () => {
    it('gets messages in conversation', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('PATCH /api/v1/conversations/:id/read', () => {
    it('marks conversation as read', async () => {
      const token = await generateToken();
      await request(app!.getHttpServer())
        .patch(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });

  describe('POST /api/v1/conversations/recruiting', () => {
    it('creates recruiting conversation when authorized', async () => {
      const token = await generateToken();
      const response = await request(app!.getHttpServer())
        .post('/api/v1/conversations/recruiting')
        .set('Authorization', `Bearer ${token}`)
        .send({ candidateUserId: otherUserId })
        .expect(201);

      expect(response.body.data).toBeDefined();
    });

    it('returns 403 when recruiting authorization is denied', async () => {
      const recruitingPolicy = app!.get(RecruitingPolicyService);
      const orig = recruitingPolicy.canMessageCandidate;
      recruitingPolicy.canMessageCandidate = jest.fn().mockResolvedValue({
        allowed: false,
        reason: 'NO_RECRUITING_AUTHORIZATION',
      });

      const token = await generateToken();
      await request(app!.getHttpServer())
        .post('/api/v1/conversations/recruiting')
        .set('Authorization', `Bearer ${token}`)
        .send({ candidateUserId: otherUserId })
        .expect(403);

      recruitingPolicy.canMessageCandidate = orig;
    });
  });
});
