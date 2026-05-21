import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import { join } from 'path';
import request from 'supertest';
import type { App } from 'supertest/types';

jest.setTimeout(120_000);

describe('Messaging (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let container: StartedPostgreSqlContainer;
  let originalEnv: NodeJS.ProcessEnv;
  let PrismaService: Type<unknown>;

  let userId: string;
  let otherUserId: string;
  let blockedUserId: string;

  beforeEach(async () => {
    originalEnv = { ...process.env };

    // Start PostgreSQL container
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('mdc_test')
      .withUsername('test')
      .withPassword('test')
      .start();

    const dbUrl = container.getConnectionUri();

    // Push schema to test DB (uses db push since some models lack migrations)
    execSync('npx prisma db push --skip-generate', {
      cwd: join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'pipe',
    });

    // Set environment variables
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = dbUrl;
    process.env.PORT = '3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.BODY_JSON_LIMIT = '1mb';
    process.env.BODY_URLENCODED_LIMIT = '1mb';
    process.env.REDIS_URL = 'redis://localhost:6379';
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

    // Import real modules
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

    // Build NestJS testing module — override only infra services, NOT DB/domain services
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue({
        live: jest.fn().mockResolvedValue({ status: 'ok' }),
        ready: jest.fn().mockResolvedValue({ status: 'ok' }),
      })
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
      .overrideProvider(EmailProcessor)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();

    // Seed test users via real PrismaService
    const prisma: Record<string, any> = app.get(PrismaService);
    const user1 = await prisma.user.create({
      data: {
        email: 'user1@test.com',
        passwordHash: 'hashed',
        emailVerifiedAt: new Date(),
        displayName: 'User One',
      },
    });
    userId = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'user2@test.com',
        passwordHash: 'hashed',
        emailVerifiedAt: new Date(),
        displayName: 'User Two',
      },
    });
    otherUserId = user2.id;

    const user3 = await prisma.user.create({
      data: {
        email: 'blocked@test.com',
        passwordHash: 'hashed',
        emailVerifiedAt: new Date(),
        displayName: 'Blocked User',
      },
    });
    blockedUserId = user3.id;
  });

  afterEach(async () => {
    if (app) await app.close();
    if (container) await container.stop();
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  function generateToken(sub: string): string {
    return app!.get(JwtService).sign({ sub });
  }

  describe('POST /api/v1/conversations', () => {
    it('creates a new conversation', async () => {
      const token = generateToken(userId);
      const response = await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [otherUserId] })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.type).toBe('DIRECT');
      expect(response.body.data.participants).toHaveLength(2);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.type).toBe('DIRECT');
      expect(response.body.data.participants).toHaveLength(2);
    });

    it('returns 401 without auth token', async () => {
      await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .send({ participantIds: [otherUserId] })
        .expect(401);
    });

    it('returns 400 for self-conversation', async () => {
      const token = generateToken(userId);
      await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [userId] })
        .expect(400);
    });
  });

  describe('POST /api/v1/conversations/recruiting', () => {
    it('returns 403 when recruiter has no authorization', async () => {
      const token = generateToken(userId);
      await request(app!.getHttpServer())
        .post('/api/v1/conversations/recruiting')
        .set('Authorization', `Bearer ${token}`)
        .send({ candidateUserId: otherUserId })
        .expect(403);
    });
  });

  describe('POST /api/v1/conversations/:id/messages', () => {
    let conversationId: string;

    beforeEach(async () => {
      // Create a conversation first so we can send messages in it
      const token = generateToken(userId);
      const res = await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [otherUserId] })
        .expect(201);
      conversationId = res.body.data.id;
    });

    it('sends a message in a conversation', async () => {
      const token = generateToken(userId);
      const response = await request(app!.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello from real DB!' })
        .expect(201);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.content).toBe('Hello from real DB!');
      expect(response.body.data.senderId).toBe(userId);
      expect(response.body.data.conversationId).toBe(conversationId);
    });

    it('returns 403 for non-participant', async () => {
      // blockedUserId is not a participant in this conversation
      const token = generateToken(blockedUserId);
      await request(app!.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Should fail' })
        .expect(403);
    });

    it('returns 403 when sender is blocked', async () => {
      // Create a block: otherUser blocks userId
      const prisma: Record<string, any> = app!.get(PrismaService);
      await prisma.block.create({
        data: {
          blockerId: otherUserId,
          blockedId: userId,
        },
      });

      const token = generateToken(userId);
      await request(app!.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Should be blocked' })
        .expect(403);
    });
  });

  describe('GET /api/v1/conversations', () => {
    it('lists user conversations', async () => {
      // Create a conversation first
      const token = generateToken(userId);
      await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [otherUserId] })
        .expect(201);

      const response = await request(app!.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/v1/conversations/:id/messages', () => {
    it('gets messages in conversation with cursor pagination', async () => {
      const token = generateToken(userId);

      // Create conversation
      const convRes = await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [otherUserId] })
        .expect(201);
      const conversationId = convRes.body.data.id;

      // Send a message
      await request(app!.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Test message' })
        .expect(201);

      // Get messages
      const response = await request(app!.getHttpServer())
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].content).toBe('Test message');
    });
  });

  describe('PATCH /api/v1/conversations/:id/read', () => {
    it('marks conversation as read', async () => {
      const token = generateToken(userId);

      // Create conversation
      const convRes = await request(app!.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ participantIds: [otherUserId] })
        .expect(201);
      const conversationId = convRes.body.data.id;

      await request(app!.getHttpServer())
        .patch(`/api/v1/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
});
