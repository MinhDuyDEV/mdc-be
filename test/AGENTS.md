# test/ — End-to-End Testing

**Parent:** ../AGENTS.md  
**Generated:** 2026-05-16

## PURPOSE

End-to-end testing for mdc-be validates the full application stack: HTTP routing, middleware, validation, error handling, and dependency integration (Postgres, Redis). Tests run against a real NestJS application instance with mocked external services.

## KEY FILES

| File | Purpose |
|------|---------|
| `app.e2e-spec.ts` | Contract tests for HTTP routes, health checks, security headers, validation, and payload limits |
| `jest-e2e.json` | Jest configuration for e2e tests; runs files matching `.e2e-spec.ts` |

## TESTING APPROACH

### Test Structure

E2E tests use **NestJS Testing Module** to bootstrap a real application instance:

```typescript
const moduleFixture = await Test.createTestingModule({
  imports: [AppModule],
  controllers: [ContractController], // test-only controllers
})
  .overrideProvider(PrismaService)
  .useValue({ /* mocked */ })
  .overrideProvider(RedisHealthService)
  .useValue({ /* mocked */ })
  .compile();

app = moduleFixture.createNestApplication({ bodyParser: false });
configureApp(app); // apply middleware, pipes, filters
await app.init();
```

### Environment Setup

Each test suite sets environment variables before bootstrapping:

- `NODE_ENV=test`
- `PORT=3000`
- `CORS_ORIGINS=http://localhost:3000,http://localhost:5173`
- `BODY_JSON_LIMIT=1kb`, `BODY_URLENCODED_LIMIT=1kb`
- `DATABASE_URL=postgresql://mdc:mdc_dev_password@localhost:5432/mdc?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `HEALTH_DATABASE_TIMEOUT_MS=1000`, `HEALTH_REDIS_TIMEOUT_MS=1000`

Environment is restored after each test to prevent cross-test pollution.

### Mocking Strategy

- **PrismaService**: Mocked with `$connect`, `$disconnect`, `$queryRaw` (returns `[{ '?column?': 1 }]`)
- **RedisHealthService**: Mocked with `ping()` returning `undefined`
- Real middleware, pipes, filters, and error handlers execute normally

### HTTP Testing

Tests use **supertest** to make HTTP requests against the running app:

```typescript
request(app.getHttpServer())
  .get('/api/v1/contract')
  .expect(200)
  .expect(response => { /* assertions */ })
```

## TESTING REQUIREMENTS

### Contract Tests

Every e2e test validates a specific contract:

1. **Root smoke test** — `GET /` returns `200` with `"Hello World!"`
2. **Liveness probe** — `GET /health/live` returns `{ status: 'ok', checks: { api: { status: 'up' } } }`
3. **Readiness probe** — `GET /health/ready` returns `{ status: 'ok', checks: { postgres: { status: 'up' }, redis: { status: 'up' } } }`
4. **Security headers** — All responses include `x-content-type-options: nosniff` (Helmet)
5. **API versioning** — Application routes are behind `/api/v1`; direct routes return `404`
6. **Response envelope** — Successful responses wrap data: `{ data: { /* payload */ } }`
7. **Validation errors** — Invalid payloads return `400` with error envelope: `{ error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [...] } }`
8. **Payload limits** — Requests exceeding `BODY_JSON_LIMIT` return `413`

### Test Isolation

- `beforeEach`: Create fresh app instance, set environment
- `afterEach`: Close app, restore environment, clear mocks
- No shared state between tests

## COMMON PATTERNS

### Adding a New E2E Test

```typescript
it('describes the contract being tested', async () => {
  const response = await request(app!.getHttpServer())
    .post('/api/v1/endpoint')
    .send({ /* payload */ })
    .expect(200); // or expected status code

  expect(response.body).toEqual({
    data: { /* expected response */ }
  });
});
```

### Testing Validation

```typescript
it('rejects invalid input', async () => {
  const response = await request(app!.getHttpServer())
    .post('/api/v1/endpoint')
    .send({ invalidField: 'value' })
    .expect(400);

  expect(response.body.error.code).toBe('VALIDATION_ERROR');
  expect(response.body.error.details).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ property: 'invalidField' })
    ])
  );
});
```

### Testing Health Checks

Health checks are mocked; verify the response structure and status codes:

```typescript
it('returns readiness with mocked dependencies', async () => {
  const response = await request(app!.getHttpServer())
    .get('/health/ready')
    .expect(200);

  expect(response.body.checks).toHaveProperty('postgres');
  expect(response.body.checks).toHaveProperty('redis');
});
```

### Testing Payload Limits

Set `BODY_JSON_LIMIT` in `beforeEach` and send oversized payloads:

```typescript
it('rejects oversized payloads', () => {
  return request(app!.getHttpServer())
    .post('/api/v1/endpoint')
    .send({ data: 'x'.repeat(2_000) })
    .expect(413);
});
```

## DEPENDENCIES

### Runtime

- **@nestjs/common** — Decorators, controllers, pipes
- **@nestjs/testing** — `Test.createTestingModule`, `INestApplication`
- **supertest** — HTTP request builder and assertions
- **class-validator** — DTO validation (via `@IsString()`, etc.)
- **jest** — Test runner and assertions

### Configuration

- **jest-e2e.json** — Configures Jest to run `.e2e-spec.ts` files with `ts-jest` transformer
- **tsconfig.json** — Must have `experimentalDecorators` and `emitDecoratorMetadata` enabled

### External Services (Mocked)

- **Postgres** — Mocked via `PrismaService`
- **Redis** — Mocked via `RedisHealthService`

## RUNNING TESTS

```bash
# Run all e2e tests
npm run test:e2e

# Run a specific test file
npm run test:e2e -- app.e2e-spec.ts

# Run with coverage
npm run test:e2e -- --coverage

# Watch mode
npm run test:e2e -- --watch
```

## AGENT INSTRUCTIONS

When writing or updating e2e tests:

1. **Understand the contract** — Read the controller and service to understand what the endpoint should return
2. **Set up environment** — Ensure all required env vars are set in `beforeEach`
3. **Mock external services** — Override `PrismaService` and `RedisHealthService` with predictable mocks
4. **Test the full stack** — Include middleware, pipes, filters, and error handlers in assertions
5. **Verify response envelopes** — All successful responses must wrap data in `{ data: { ... } }`; errors in `{ error: { code, message, details } }`
6. **Test edge cases** — Validation failures, oversized payloads, missing fields, type mismatches
7. **Isolate tests** — Use `beforeEach`/`afterEach` to prevent cross-test pollution
8. **Use descriptive names** — Test names should read like contracts: "GET /api/v1/endpoint returns 200 with data envelope"
9. **Assert response structure** — Don't just check status codes; verify the response body matches the contract
10. **Keep tests focused** — One contract per test; avoid testing multiple concerns in a single `it` block
