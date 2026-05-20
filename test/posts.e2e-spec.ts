import type { INestApplication, Type } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { PostStatus, PostVisibility, ReactionType } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types';

describe('Posts (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;
  let PrismaService: Type<unknown>;

  const userId = 'aaaa0000-0000-4000-8000-000000000001';
  const postId = 'a0010001-0000-4000-8000-000000000001';
  const commentId = 'a0020001-0000-4000-8000-000000000001';
  const reactionId = 'a0030001-0000-4000-8000-000000000001';

  const mockUser = {
    id: userId,
    email: 'usera@example.com',
    passwordHash: null,
    displayName: 'User A',
    emailVerifiedAt: new Date(),
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPost = {
    id: postId,
    authorId: userId,
    content: 'Test post content #test',
    visibility: PostVisibility.PUBLIC,
    status: PostStatus.PUBLISHED,
    commentCount: 0,
    reactionCount: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: {
      id: userId,
      email: 'usera@example.com',
      profile: { firstName: 'User', lastName: 'A', headline: 'Engineer' },
    },
    hashtags: [],
    media: [],
  };

  const mockComment = {
    id: commentId,
    postId,
    authorId: userId,
    content: 'Test comment',
    parentId: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReaction = {
    id: reactionId,
    postId,
    authorId: userId,
    type: ReactionType.LIKE,
    createdAt: new Date(),
  };

  const mockSavedPost = {
    id: 'a0040001-0000-4000-8000-000000000001',
    postId,
    userId,
    createdAt: new Date(),
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
    const { IdempotencyService: IS } = jest.requireActual<{
      IdempotencyService: Type<unknown>;
    }>('./../src/outbox');
    const { EmailProcessor } = jest.requireActual<{
      EmailProcessor: Type<unknown>;
    }>('./../src/email/email.processor');
    const { OutboxService } = jest.requireActual<{
      OutboxService: Type<unknown>;
    }>('./../src/outbox/outbox.service');
    const { NotificationProcessor } = jest.requireActual<{
      NotificationProcessor: Type<unknown>;
    }>('./../src/outbox/processors/notification.processor');
    const { PostInteractionProcessor } = jest.requireActual<{
      PostInteractionProcessor: Type<unknown>;
    }>('./../src/outbox/processors/post-interaction.processor');
    const { CompanySearchIndexProcessor } = jest.requireActual<{
      CompanySearchIndexProcessor: Type<unknown>;
    }>('./../src/outbox/processors/company-search-index.processor');
    const { JobSearchIndexProcessor } = jest.requireActual<{
      JobSearchIndexProcessor: Type<unknown>;
    }>('./../src/outbox/processors/job-search-index.processor');
    const { ConnectionsService } = jest.requireActual<{
      ConnectionsService: Type<unknown>;
    }>('./../src/connections/connections.service');
    const { PostsService } = jest.requireActual<{
      PostsService: Type<unknown>;
    }>('./../src/posts/posts.service');
    const { PostsPolicyService: PPS } = jest.requireActual<{
      PostsPolicyService: Type<unknown>;
    }>('./../src/posts/posts-policy.service');

    const transactionMock: Record<string, unknown> = {
      post: {
        create: jest.fn().mockResolvedValue(mockPost),
        update: jest.fn().mockResolvedValue(mockPost),
        findUnique: jest.fn().mockResolvedValue(mockPost),
      },
      comment: {
        create: jest.fn().mockResolvedValue(mockComment),
        update: jest.fn().mockResolvedValue(mockComment),
      },
      reaction: {
        create: jest.fn().mockResolvedValue(mockReaction),
        delete: jest.fn().mockResolvedValue(mockReaction),
      },
      savedPost: {
        create: jest.fn().mockResolvedValue(mockSavedPost),
        delete: jest.fn().mockResolvedValue(mockSavedPost),
      },
      hashtag: {
        upsert: jest.fn().mockResolvedValue({ id: 'hash0001', name: 'test' }),
      },
      postHashtag: {
        create: jest.fn().mockResolvedValue({}),
      },
      postMedia: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      mention: {
        create: jest.fn().mockResolvedValue({}),
      },
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
          findUnique: jest.fn().mockResolvedValue(mockUser),
          findFirst: jest.fn().mockResolvedValue(mockUser),
        },
        post: {
          findUnique: jest.fn().mockImplementation((args: any) => {
            if (args?.where?.id === '00000000-0000-0000-0000-ffffffffffff')
              return null;
            return mockPost;
          }),
          findMany: jest.fn().mockResolvedValue([mockPost]),
          create: jest.fn().mockResolvedValue(mockPost),
          update: jest.fn().mockResolvedValue(mockPost),
        },
        comment: {
          findUnique: jest.fn().mockResolvedValue(mockComment),
          findMany: jest.fn().mockResolvedValue([mockComment]),
          create: jest.fn().mockResolvedValue(mockComment),
          update: jest.fn().mockResolvedValue(mockComment),
        },
        reaction: {
          findUnique: jest.fn().mockResolvedValue(mockReaction),
          findFirst: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue(mockReaction),
          delete: jest.fn().mockResolvedValue(mockReaction),
        },
        savedPost: {
          findUnique: jest.fn().mockResolvedValue(null),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockSavedPost),
          delete: jest.fn().mockResolvedValue(mockSavedPost),
        },
        hiddenPost: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({}),
          delete: jest.fn().mockResolvedValue({}),
        },
        hashtag: {
          upsert: jest.fn().mockResolvedValue({ id: 'hash0001', name: 'test' }),
        },
        postHashtag: {
          create: jest.fn().mockResolvedValue({}),
        },
        postMedia: {
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        mention: {
          create: jest.fn().mockResolvedValue({}),
        },
        connection: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockReturnValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        follow: {
          findFirst: jest.fn().mockReturnValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        block: {
          findFirst: jest.fn().mockReturnValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
        outboxEvent: {
          create: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
        application: {
          findMany: jest.fn().mockResolvedValue([]),
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
        },
        job: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        savedCandidate: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
        },
        talentPool: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn().mockResolvedValue(0),
        },
        talentPoolEntry: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        idempotencyKey: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        notification: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
        },
        refreshToken: {
          create: jest.fn(),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        verificationToken: {
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        emailDelivery: {
          create: jest.fn(),
          update: jest.fn(),
        },
      })
      .overrideProvider(StorageService)
      .useValue({
        put: jest.fn().mockResolvedValue({
          key: 'test-key',
          url: 'https://s3.example.com/test-key',
        }),
        presignUrl: jest
          .fn()
          .mockResolvedValue('https://s3.example.com/test-key?presigned'),
        delete: jest.fn().mockResolvedValue(undefined),
        healthCheck: jest.fn().mockResolvedValue({ status: 'up' }),
      })
      .overrideProvider(StorageHealthService)
      .useValue({
        check: jest.fn().mockResolvedValue({ status: 'up' }),
      })
      .overrideProvider(SearchEngineService)
      .useValue({
        index: jest.fn().mockResolvedValue(undefined),
        search: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
        delete: jest.fn().mockResolvedValue(undefined),
        healthCheck: jest.fn().mockResolvedValue({ status: 'up' }),
      })
      .overrideProvider(SearchEngineHealthService)
      .useValue({
        check: jest.fn().mockResolvedValue({ status: 'up' }),
      })
      .overrideProvider(MailerService)
      .useValue({
        send: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
        healthCheck: jest.fn().mockResolvedValue({ status: 'up' }),
      })
      .overrideProvider(MailerHealthService)
      .useValue({
        check: jest.fn().mockResolvedValue({ status: 'up' }),
      })
      .overrideProvider(SearchIndexService)
      .useValue({
        indexCompany: jest.fn(),
        indexProfile: jest.fn(),
      })
      .overrideProvider(SearchService)
      .useValue({
        searchCompanies: jest
          .fn()
          .mockResolvedValue({ data: [], meta: { total: 0 } }),
        searchProfiles: jest
          .fn()
          .mockResolvedValue({ data: [], meta: { total: 0 } }),
      })
      .overrideProvider(OutboxProcessor)
      .useValue({
        process: jest.fn(),
      })
      .overrideProvider(DeadLetterService)
      .useValue({
        moveToDeadLetter: jest.fn(),
        replay: jest.fn(),
      })
      .overrideProvider(IS)
      .useValue({
        claim: jest.fn().mockResolvedValue({}),
      })
      .overrideProvider(OutboxService)
      .useValue({
        emit: jest.fn(),
      })
      .overrideProvider(EmailProcessor)
      .useValue({
        process: jest.fn(),
      })
      .overrideProvider(NotificationProcessor)
      .useValue({
        processApplicationSubmitted: jest.fn(),
        processApplicationStatusChanged: jest.fn(),
        processApplicationNoteAdded: jest.fn(),
      })
      .overrideProvider(PostInteractionProcessor)
      .useValue({
        processPostCreated: jest.fn(),
        processCommentAdded: jest.fn(),
        processReactionAdded: jest.fn(),
        processMentionCreated: jest.fn(),
      })
      .overrideProvider(CompanySearchIndexProcessor)
      .useValue({
        processCompanyCreated: jest.fn(),
        processCompanyUpdated: jest.fn(),
      })
      .overrideProvider(JobSearchIndexProcessor)
      .useValue({
        processJobCreated: jest.fn(),
        processJobUpdated: jest.fn(),
        processJobPublished: jest.fn(),
        processJobClosed: jest.fn(),
        processJobDeleted: jest.fn(),
      })
      .overrideProvider(ConnectionsService)
      .useValue({
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        rejectConnection: jest.fn(),
      })
      .overrideProvider(PostsService)
      .useValue({
        createPost: jest.fn().mockResolvedValue({
          id: postId,
          authorId: userId,
          content: 'Test post content #test',
          visibility: PostVisibility.PUBLIC,
          status: PostStatus.PUBLISHED,
          commentCount: 0,
          reactionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: userId,
            email: 'usera@example.com',
            profile: { firstName: 'User', lastName: 'A', headline: 'Engineer' },
          },
          hashtags: [],
          media: [],
        }),
        getPost: jest.fn().mockResolvedValue({
          id: postId,
          authorId: userId,
          content: 'Test post content #test',
          visibility: PostVisibility.PUBLIC,
          status: PostStatus.PUBLISHED,
          commentCount: 0,
          reactionCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: userId,
            email: 'usera@example.com',
            profile: { firstName: 'User', lastName: 'A', headline: 'Engineer' },
          },
          hashtags: [],
          media: [],
        }),
        updatePost: jest.fn().mockResolvedValue({
          id: postId,
          content: 'Updated content',
        }),
        deletePost: jest.fn().mockResolvedValue(undefined),
        createComment: jest.fn().mockResolvedValue({
          id: commentId,
          postId,
          authorId: userId,
          content: 'Test comment',
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        deleteComment: jest.fn().mockResolvedValue(undefined),
        addReaction: jest.fn().mockResolvedValue({
          id: reactionId,
          postId,
          authorId: userId,
          type: ReactionType.LIKE,
          createdAt: new Date(),
        }),
        removeReaction: jest.fn().mockResolvedValue(undefined),
        savePost: jest.fn().mockResolvedValue({
          id: 'save0001',
          postId,
          userId,
          createdAt: new Date(),
        }),
        unsavePost: jest.fn().mockResolvedValue(undefined),
      })
      .overrideProvider(PPS)
      .useValue({
        canViewPost: jest.fn().mockResolvedValue(true),
        filterVisiblePostIds: jest.fn().mockResolvedValue([]),
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
    const jwtService = app!.get(JwtService);
    return jwtService.sign({ sub: userId });
  };

  it('POST /api/v1/posts creates a post', async () => {
    const token = await generateToken();

    const response = await request(app!.getHttpServer())
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Test post content #test' })
      .expect(201);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.content).toBe('Test post content #test');
    expect(response.body.data.visibility).toBe(PostVisibility.PUBLIC);
  });

  it('GET /api/v1/posts/:id returns a post', async () => {
    const token = await generateToken();

    const response = await request(app!.getHttpServer())
      .get(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.id).toBe(postId);
    expect(response.body.data.author).toBeDefined();
  });

  it('PATCH /api/v1/posts/:id updates a post', async () => {
    const token = await generateToken();

    const response = await request(app!.getHttpServer())
      .patch(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Updated content' })
      .expect(200);

    expect(response.body.data).toBeDefined();
  });

  it('DELETE /api/v1/posts/:id deletes a post', async () => {
    const token = await generateToken();

    await request(app!.getHttpServer())
      .delete(`/api/v1/posts/${postId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('POST /api/v1/posts/:id/comments creates a comment', async () => {
    const token = await generateToken();

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Test comment' })
      .expect(201);

    expect(response.body.data).toBeDefined();
    expect(response.body.data.content).toBe('Test comment');
  });

  it('DELETE /api/v1/comments/:id deletes a comment', async () => {
    const token = await generateToken();

    await request(app!.getHttpServer())
      .delete(`/api/v1/posts/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('POST /api/v1/posts/:id/reactions adds a reaction', async () => {
    const token = await generateToken();

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/posts/${postId}/reactions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: ReactionType.LIKE })
      .expect(201);

    expect(response.body.data).toBeDefined();
  });

  it('DELETE /api/v1/reactions/:id removes a reaction', async () => {
    const token = await generateToken();

    await request(app!.getHttpServer())
      .delete(`/api/v1/posts/reactions/${reactionId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('POST /api/v1/posts/:id/save saves a post', async () => {
    const token = await generateToken();

    const response = await request(app!.getHttpServer())
      .post(`/api/v1/posts/${postId}/save`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(response.body.data).toBeDefined();
  });

  it('DELETE /api/v1/posts/:id/save unsaves a post', async () => {
    const token = await generateToken();

    await request(app!.getHttpServer())
      .delete(`/api/v1/posts/${postId}/save`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });
});
