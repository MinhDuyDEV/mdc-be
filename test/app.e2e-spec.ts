import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
  type Type,
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';

class ContractDto {
  @IsString()
  name!: string;
}

@Controller('contract')
class ContractController {
  @Get()
  getContract() {
    return { ok: true };
  }

  @Post()
  postContract(@Body() body: ContractDto) {
    return body;
  }
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App> | undefined;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173';
    process.env.BODY_JSON_LIMIT = '1kb';
    process.env.BODY_URLENCODED_LIMIT = '1kb';
    process.env.DATABASE_URL =
      'postgresql://mdc:mdc_dev_password@localhost:5432/mdc?schema=public';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.HEALTH_DATABASE_TIMEOUT_MS = '1000';
    process.env.HEALTH_REDIS_TIMEOUT_MS = '1000';

    const { AppModule } = jest.requireActual<{ AppModule: Type<unknown> }>(
      './../src/app.module',
    );
    const { configureApp } = jest.requireActual<{
      configureApp: (app: INestApplication) => void;
    }>('./../src/bootstrap');
    const { PrismaService } = jest.requireActual<{
      PrismaService: Type<unknown>;
    }>('./../src/infra/prisma');
    const { RedisHealthService } = jest.requireActual<{
      RedisHealthService: Type<unknown>;
    }>('./../src/infra/redis');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ContractController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      })
      .overrideProvider(RedisHealthService)
      .useValue({
        ping: jest.fn().mockResolvedValue(undefined),
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

  it('/ (GET) preserves the root smoke response', () => {
    return request(app!.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health/live (GET) returns dependency-free liveness', async () => {
    const response = await request(app!.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      checks: { api: { status: 'up' } },
    });
  });

  it('/health/ready (GET) returns Postgres and Redis readiness', async () => {
    const response = await request(app!.getHttpServer())
      .get('/health/ready')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      checks: {
        postgres: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('sets baseline Helmet security headers', () => {
    return request(app!.getHttpServer())
      .get('/')
      .expect('x-content-type-options', 'nosniff')
      .expect(200);
  });

  it('keeps application controllers behind /api/v1 and envelopes successes', async () => {
    await request(app!.getHttpServer()).get('/contract').expect(404);

    const response = await request(app!.getHttpServer())
      .get('/api/v1/contract')
      .expect(200);
    expect(response.body).toEqual({ data: { ok: true } });
  });

  it('maps validation failures to the public error envelope', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/contract')
      .send({ name: 123, extra: 'rejected' })
      .expect(400);
    const body = response.body as {
      error: { code: string; message: string; details: unknown };
    };

    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'extra' }),
        expect.objectContaining({ property: 'name' }),
      ]),
    );
  });

  it('rejects JSON bodies over the configured limit', () => {
    return request(app!.getHttpServer())
      .post('/api/v1/contract')
      .send({ name: 'a'.repeat(2_000) })
      .expect(413);
  });
});
